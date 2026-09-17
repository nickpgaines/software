#!/bin/sh
set -eu
test_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
developer_dir=$(xcode-select -p)
platform_dir="$developer_dir/Platforms/MacOSX.platform/Developer"
test_output=$(mktemp -d /private/tmp/forge-terminal-tests.XXXXXX)
xcrun swiftc -DTERMINAL_STANDALONE \
  -I "$platform_dir/usr/lib" -F "$platform_dir/Library/Frameworks" -L "$platform_dir/usr/lib" \
  -Xlinker -rpath -Xlinker "$platform_dir/Library/Frameworks" \
  -Xlinker -rpath -Xlinker "$platform_dir/usr/lib" \
  "$test_dir/../App/ForgeTerminalCoordinator.swift" \
  "$test_dir/../App/ForgeTerminalSessionPolicy.swift" \
  "$test_dir/../App/ForgeTerminalSession.swift" \
  "$test_dir/ForgeTerminalTests.swift" "$test_dir/TerminalTestMain.swift" \
  -o "$test_output/ForgeTerminalTests"
"$test_output/ForgeTerminalTests"
