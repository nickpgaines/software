import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, signIn, loadRoutes, onNextTransaction } from './helpers/team-harness.mjs';

const routes = await loadRoutes();
const request = (method: string, body?: unknown) => new Request('https://forge.example/api/staff', {
  method, ...(body ? { body:JSON.stringify(body), headers:{'Content-Type':'application/json'} } : {}),
});
const params = (id: number) => ({ params:{ id:String(id) } });
const create = { first_name:'New', last_name:'Employee', email:'new@example.invalid', password:'test-only-password', permission_level:'technician' };

for (const [name, invoke] of [
  ['create employee', () => routes.staff.POST(request('POST', create))],
  ['legacy employee create', () => routes.staff.POST(request('POST', { name:'Legacy employee' }))],
  ['promote self', () => routes.member.PATCH(request('PATCH', { permission_level:'admin' }), params(2))],
  ['reset another password', () => routes.member.PATCH(request('PATCH', { password:'changed' }), params(1))],
  ['create role', () => routes.roles.POST(request('POST', {name:'Escalation', permissions:['settings.view_all']}))],
  ['edit role', () => routes.role.PATCH(request('PATCH', {permissions:['team.manage','settings.view_all']}), params(10))],
  ['delete role', () => routes.role.DELETE(request('DELETE'), params(10))],
] as const) {
  test(`technician cannot ${name}`, async () => {
    const db = fixture(); signIn(2);
    const before = JSON.stringify(db.sqlite.prepare('SELECT * FROM staff').all()) + JSON.stringify(db.sqlite.prepare('SELECT * FROM custom_roles').all());
    const response = await invoke();
    assert.equal(response.status, 403);
    assert.equal(JSON.stringify(db.sqlite.prepare('SELECT * FROM staff').all()) + JSON.stringify(db.sqlite.prepare('SELECT * FROM custom_roles').all()), before);
  });
}
test('admin can create staff, without returning password hashes', async () => {
  const db = fixture();
  const response = await routes.staff.POST(request('POST', create));
  assert.equal(response.status, 201);
  assert.equal(Object.hasOwn(await response.json(), 'password_hash'), false);
  assert.equal(db.sqlite.prepare('SELECT permission_level FROM staff WHERE email=?').get(create.email).permission_level, 'technician');
});
test('staff roster remains accessible for assignment without exposing password hashes', async () => {
  fixture(); signIn(2);
  const response = await routes.staff.GET();
  assert.equal(response.status, 200);
  const rows = await response.json();
  assert.equal(rows.length, 4);
  assert.equal(rows.some((row: object) => Object.hasOwn(row, 'password_hash')), false);
});
test('custom team manager cannot promote self, alter a more privileged employee, or grant new permissions', async () => {
  fixture(); signIn(3);
  for (const response of [
    await routes.member.PATCH(request('PATCH', {custom_role_id:null}), params(3)),
    await routes.member.PATCH(request('PATCH', {password:'changed'}), params(1)),
    await routes.roles.POST(request('POST', {name:'Escalation', permissions:['settings.view_all']})),
    await routes.role.PATCH(request('PATCH', {permissions:['team.manage','settings.view_all']}), params(10)),
    await routes.staff.POST(request('POST', {...create, permission_level:'admin'})),
  ]) assert.equal(response.status, 403);
});
test('deleting an assigned custom role cannot restore its members underlying admin permissions', async () => {
  const db = fixture();
  const response = await routes.role.DELETE(request('DELETE'), params(10));
  assert.equal(response.status, 409);
  assert.equal(db.sqlite.prepare('SELECT custom_role_id FROM staff WHERE id=3').get().custom_role_id, 10);
});
test('custom manager can create a role containing only their own permissions', async () => {
  fixture(); signIn(3);
  assert.equal((await routes.roles.POST(request('POST', {name:'Customer reader', permissions:['customers.view']}))).status, 201);
});
test('cross-tenant staff and custom roles cannot be edited or assigned', async () => {
  fixture();
  assert.equal((await routes.member.PATCH(request('PATCH', {password:'changed'}), params(5))).status, 404);
  assert.equal((await routes.role.PATCH(request('PATCH', {name:'Changed'}), params(12))).status, 404);
  assert.equal((await routes.staff.POST(request('POST', {...create, custom_role_id:12}))).status, 400);
});
for (const invalid of ['unknown-role','missing-custom-role','malformed-custom-role']) {
  test(`${invalid} does not grant team management`, async () => {
    const db = fixture(); signIn(3);
    if (invalid === 'unknown-role') db.sqlite.exec("UPDATE staff SET permission_level='unknown', custom_role_id=NULL WHERE id=3");
    if (invalid === 'missing-custom-role') db.sqlite.exec('DELETE FROM custom_roles WHERE id=10');
    if (invalid === 'malformed-custom-role') db.sqlite.exec("UPDATE custom_roles SET permissions='null' WHERE id=10");
    assert.equal((await routes.staff.POST(request('POST', create))).status, 403);
  });
}
test('role assignment revalidates the role inside the staff insertion transaction', async () => {
  const db = fixture();
  onNextTransaction(sqlite => sqlite.exec('DELETE FROM custom_roles WHERE id=10'));
  const response = await routes.staff.POST(request('POST', {...create, custom_role_id:10}));
  assert.equal(response.status, 403);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM staff').get().n, 5);
});
test('revoking team management before the write prevents a previously authorized role creation', async () => {
  const db = fixture(); signIn(3);
  onNextTransaction(sqlite => sqlite.exec(`UPDATE custom_roles SET permissions='["customers.view"]' WHERE id=10`));
  const response = await routes.roles.POST(request('POST', {name:'Customer reader', permissions:['customers.view']}));
  assert.equal(response.status, 403);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM custom_roles').get().n, 3);
});
test('a target promoted before the write cannot have its password reset by a restricted manager', async () => {
  const db = fixture(); signIn(3);
  db.sqlite.exec('UPDATE staff SET custom_role_id=10 WHERE id=4');
  onNextTransaction(sqlite => sqlite.exec('UPDATE staff SET custom_role_id=NULL WHERE id=4'));
  const response = await routes.member.PATCH(request('PATCH', {password:'changed'}), params(4));
  assert.equal(response.status, 403);
  assert.equal(db.sqlite.prepare('SELECT password_hash FROM staff WHERE id=4').get().password_hash, 'private-billing-hash');
});
test('a role assigned before deletion remains intact', async () => {
  const db = fixture();
  db.sqlite.exec('UPDATE staff SET custom_role_id=NULL WHERE id=4');
  onNextTransaction(sqlite => sqlite.exec('UPDATE staff SET custom_role_id=11 WHERE id=4'));
  assert.equal((await routes.role.DELETE(request('DELETE'), params(11))).status, 409);
  assert.equal(db.sqlite.prepare('SELECT id FROM custom_roles WHERE id=11').get().id, 11);
});
test('admin can edit and delete an unassigned role; missing roles return 404', async () => {
  const db = fixture();
  db.sqlite.exec('UPDATE staff SET custom_role_id=NULL WHERE id=4');
  assert.equal((await routes.role.PATCH(request('PATCH', {name:'Renamed'}), params(11))).status, 200);
  assert.equal(db.sqlite.prepare('SELECT name FROM custom_roles WHERE id=11').get().name, 'Renamed');
  assert.equal((await routes.role.DELETE(request('DELETE'), params(11))).status, 200);
  assert.equal(db.sqlite.prepare('SELECT id FROM custom_roles WHERE id=11').get(), undefined);
  assert.equal((await routes.role.DELETE(request('DELETE'), params(11))).status, 404);
});
test('a malformed target role fails closed even when its permissions are not being edited', async () => {
  const db = fixture();
  db.sqlite.exec("UPDATE custom_roles SET permissions='invalid-json' WHERE id=11");
  assert.equal((await routes.role.PATCH(request('PATCH', {name:'Changed'}), params(11))).status, 403);
  assert.equal(db.sqlite.prepare('SELECT name FROM custom_roles WHERE id=11').get().name, 'Payments admin');
});
test('unauthenticated mutations return 401', async () => {
  fixture(); signIn(null);
  assert.equal((await routes.staff.POST(request('POST', create))).status, 401);
  assert.equal((await routes.member.PATCH(request('PATCH', {permission_level:'admin'}), params(2))).status, 401);
  assert.equal((await routes.roles.POST(request('POST', {name:'Role',permissions:['team.manage']}))).status, 401);
});
test('admin edit returns no password hash and foreign-role assignment leaves the member unchanged', async () => {
  const db = fixture();
  const success = await routes.member.PATCH(request('PATCH', {first_name:'Renamed'}), params(2));
  assert.equal(success.status, 200);
  assert.equal(Object.hasOwn(await success.json(), 'password_hash'), false);
  assert.equal((await routes.member.PATCH(request('PATCH', {custom_role_id:12}), params(2))).status, 400);
  assert.equal(db.sqlite.prepare('SELECT custom_role_id FROM staff WHERE id=2').get().custom_role_id, null);
});
