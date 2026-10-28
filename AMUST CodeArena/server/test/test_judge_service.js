import assert from 'node:assert/strict';
import { judgeLocally, executeCustomRun } from '../src/services/judge.service.js';

async function testJudge() {
  console.log('🧪 Testing Judge Service Authenticity...');

  // 1. Broken C++ code
  console.log('\n1. Testing Broken Syntax C++:');
  const brokenCpp = `
#include <iostream>
int main() {
    this is broken syntax;
    return 0;
}
`;
  const brokenRes = await judgeLocally({
    language: 'CPP',
    sourceCode: brokenCpp,
    testcases: [{ input: '4', output: '4' }],
  });
  console.log('   Result:', brokenRes.verdict);
  assert.equal(brokenRes.verdict, 'COMPILATION_ERROR');
  assert.ok(brokenRes.compileOutput.includes('error'));
  console.log('   ✓ Broken C++ strictly returned COMPILATION_ERROR with compiler output');

  // 2. Incorrect Logic C++ code (Wrong Answer)
  console.log('\n2. Testing Incorrect Logic C++:');
  const wrongLogicCpp = `
#include <iostream>
int main() {
    int x;
    if (std::cin >> x) {
        std::cout << x + 999 << std::endl;
    }
    return 0;
}
`;
  const wrongRes = await judgeLocally({
    language: 'CPP',
    sourceCode: wrongLogicCpp,
    testcases: [{ input: '5', output: '5' }],
  });
  console.log('   Result:', wrongRes.verdict, '| Actual:', wrongRes.actualOutput?.trim(), '| Expected:', wrongRes.expectedOutput?.trim());
  assert.equal(wrongRes.verdict, 'WRONG_ANSWER');
  console.log('   ✓ Incorrect logic strictly returned WRONG_ANSWER');

  // 3. Correct Logic C++ code (Accepted)
  console.log('\n3. Testing Correct Logic C++:');
  const correctCpp = `
#include <iostream>
int main() {
    int x;
    if (std::cin >> x) {
        std::cout << x << std::endl;
    }
    return 0;
}
`;
  const correctRes = await judgeLocally({
    language: 'CPP',
    sourceCode: correctCpp,
    testcases: [{ input: '42', output: '42' }],
  });
  console.log('   Result:', correctRes.verdict);
  assert.equal(correctRes.verdict, 'ACCEPTED');
  console.log('   ✓ Correct logic strictly returned ACCEPTED');

  // 4. Try Run custom execution
  console.log('\n4. Testing Custom Run:');
  const customRes = await executeCustomRun({
    language: 'CPP',
    sourceCode: correctCpp,
    input: '12345',
  });
  console.log('   Custom run status:', customRes.status, '| Output:', customRes.stdout?.trim());
  assert.equal(customRes.status, 'SUCCESS');
  assert.equal(customRes.stdout?.trim(), '12345');
  console.log('   ✓ Custom run passed');

  console.log('\n🎉 ALL JUDGE SERVICE TESTS PASSED!\n');
}

testJudge().catch((err) => {
  console.error('❌ Judge test failed:', err);
  process.exit(1);
});
