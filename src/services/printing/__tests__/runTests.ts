import { runKOTRoutingTests } from './kotRoutingService.test';
import { runElectronPrintingTests } from './electronTargetedPrint.test';
import { runRendererTests } from './renderKOTHtml.test';
import { runDispatcherTests } from './kotPrintDispatcher.test';
import { runCartIntegrationTests } from './kotCartIntegration.test';

async function main() {
  console.log('====================================================');
  console.log('RUNNING ALL MULTI-PRINTER KOT TESTS (PHASES 3A, 3B, 4A, 4B, 5)');
  console.log('====================================================\n');

  console.log('--- SECTION 1: Pure Routing Engine Tests (Phase 3A) ---');
  const routingResults = runKOTRoutingTests();

  console.log('\n--- SECTION 2: Electron Targeted Printing IPC Tests (Phase 3B) ---');
  const ipcResults = runElectronPrintingTests();

  console.log('\n--- SECTION 3: Targeted KOT HTML Renderer Tests (Phase 4A) ---');
  const rendererResults = runRendererTests();

  console.log('\n--- SECTION 4: Multi-Printer KOT Dispatcher Tests (Phase 4B) ---');
  const dispatcherResults = await runDispatcherTests();

  console.log('\n--- SECTION 5: CartPanel Integration Tests (Phase 5) ---');
  const cartIntegrationResults = await runCartIntegrationTests();

  const allResults = [
    ...routingResults,
    ...ipcResults,
    ...rendererResults,
    ...dispatcherResults,
    ...cartIntegrationResults,
  ];
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
}

main().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});

