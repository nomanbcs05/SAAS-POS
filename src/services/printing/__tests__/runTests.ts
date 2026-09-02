import { runKOTRoutingTests } from './kotRoutingService.test';
import { runElectronPrintingTests } from './electronTargetedPrint.test';
import { runRendererTests } from './renderKOTHtml.test';

console.log('====================================================');
console.log('RUNNING ALL MULTI-PRINTER KOT TESTS (PHASES 3A, 3B, 4A)');
console.log('====================================================\n');

console.log('--- SECTION 1: Pure Routing Engine Tests (Phase 3A) ---');
const routingResults = runKOTRoutingTests();

console.log('\n--- SECTION 2: Electron Targeted Printing IPC Tests (Phase 3B) ---');
const ipcResults = runElectronPrintingTests();

console.log('\n--- SECTION 3: Targeted KOT HTML Renderer Tests (Phase 4A) ---');
const rendererResults = runRendererTests();

const allResults = [...routingResults, ...ipcResults, ...rendererResults];
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
