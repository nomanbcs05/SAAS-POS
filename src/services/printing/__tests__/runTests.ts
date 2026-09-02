import { runKOTRoutingTests } from './kotRoutingService.test';
import { runElectronPrintingTests } from './electronTargetedPrint.test';

console.log('====================================================');
console.log('RUNNING MULTI-PRINTER KOT ROUTING & IPC TESTS');
console.log('====================================================\n');

console.log('--- SECTION 1: Pure Routing Engine Tests ---');
const routingResults = runKOTRoutingTests();

console.log('\n--- SECTION 2: Electron Targeted Printing IPC Tests ---');
const ipcResults = runElectronPrintingTests();

const allResults = [...routingResults, ...ipcResults];
const total = allResults.length;
const passed = allResults.filter((r) => r.passed).length;
const failed = total - passed;

console.log('\n====================================================');
console.log(`TOTAL TEST SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
