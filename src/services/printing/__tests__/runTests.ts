import { runKOTRoutingTests } from './kotRoutingService.test';

console.log('====================================================');
console.log('RUNNING PURE MULTI-PRINTER KOT ROUTING ENGINE TESTS');
console.log('====================================================\n');

const results = runKOTRoutingTests();

const total = results.length;
const passed = results.filter((r) => r.passed).length;
const failed = total - passed;

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
