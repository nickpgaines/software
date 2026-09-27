#if TERMINAL_STANDALONE
import XCTest

@main
struct TerminalTestMain {
    static func main() {
        let suite = XCTestSuite(forTestCaseClass: ForgeTerminalTests.self)
        suite.run()
        print("Executed \(suite.testRun!.executionCount) tests; failures: \(suite.testRun!.totalFailureCount)")
        exit(suite.testRun!.hasSucceeded ? 0 : 1)
    }
}
#endif
