export type TerminalAnnouncementContent={approved:true;version:string;title:string;body:string;reviewReference:string};
// Supply owner-reviewed Apple marketing toolkit content in a separately reviewed
// change. Deployment and environment flags alone cannot enable an announcement.
export const approvedTerminalAnnouncement:TerminalAnnouncementContent|null=null;
