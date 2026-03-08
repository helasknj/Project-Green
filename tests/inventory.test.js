// GreenStock Inventory Assistant - Tests
// Run with: node tests/inventory.test.js

// ─── Utility functions (copied from App logic for isolated testing) ───────────

function daysUntilEmpty(item) {
  if (!item.dailyUsage || item.dailyUsage <= 0) return null;
  return Math.max(0, Math.floor(item.quantity / item.dailyUsage));
}

function ruleBasedForecast(item) {
  const days = daysUntilEmpty(item);
  if (days === null) return "No usage data available. Set a daily usage rate to enable predictions.";
  if (days === 0) return `⚠️ ${item.name} is depleted! Reorder immediately.`;
  if (days <= 3) return `🔴 Critical: ${item.name} will run out in ${days} day${days === 1 ? "" : "s"}. Reorder now.`;
  if (days <= 7) return `🟠 Low stock: ${item.name} will last ~${days} days. Consider reordering soon.`;
  if (days <= 14) return `🟡 ${item.name} has ~${days} days of stock remaining.`;
  return `🟢 ${item.name} is well stocked — estimated ${days} days of supply remaining.`;
}

function sustainabilityScore(items) {
  let score = 0;
  let wasteRisk = 0;
  items.forEach((item) => {
    const days = daysUntilEmpty(item);
    if (item.expiryDays && days && days > item.expiryDays) wasteRisk += 1;
    if (item.isEcoFriendly) score += 10;
    if (item.isLocal) score += 8;
    if (item.isRefurbished) score += 6;
  });
  const base = Math.max(0, 60 - wasteRisk * 5);
  return Math.min(100, base + score);
}

function validateItem(form) {
  const errors = {};
  if (!form.name || !form.name.trim()) errors.name = "Name is required.";
  if (form.quantity === "" || isNaN(form.quantity) || Number(form.quantity) < 0)
    errors.quantity = "Quantity must be a non-negative number.";
  if (form.dailyUsage !== "" && (isNaN(form.dailyUsage) || Number(form.dailyUsage) < 0))
    errors.dailyUsage = "Daily usage must be a non-negative number.";
  return errors;
}

// ─── Test Runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  PASSED: ${description}`);
    passed++;
  } catch (e) {
    console.log(`  FAILED: ${description}`);
    console.log(`     why: ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

function assertEqual(actual, expected, message) {
  if (actual !== expected)
    throw new Error(message || `Expected "${expected}", got "${actual}"`);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log("\n Test Suite\n");

// ── Happy Path Tests ──────────────────────────────────────────────────────────
console.log("Happy Path Tests:");

test("daysUntilEmpty calculates correctly for normal item", () => {
  const item = { quantity: 20, dailyUsage: 4, unit: "liters" };
  assertEqual(daysUntilEmpty(item), 5, "Expected 5 days (20/4)");
});

test("ruleBasedForecast returns green status for well-stocked item", () => {
  const item = { name: "Coffee", quantity: 100, dailyUsage: 2, unit: "kg" };
  const result = ruleBasedForecast(item);
  assert(result.includes("🟢"), "Expected green (well stocked) status");
  assert(result.includes("50"), "Expected 50 days remaining");
});

test("ruleBasedForecast returns critical alert for low-stock item", () => {
  const item = { name: "Milk", quantity: 3, dailyUsage: 2, unit: "liters" };
  const result = ruleBasedForecast(item);
  assert(result.includes("🔴") || result.includes("⚠️"), "Expected red/critical status");
});

test("ruleBasedForecast returns 'low' warning for 5-day item", () => {
  const item = { name: "Sugar", quantity: 10, dailyUsage: 2, unit: "kg" };
  const result = ruleBasedForecast(item);
  assert(result.includes("🟠"), "Expected orange low-stock warning");
});

test("sustainabilityScore increases with eco-friendly items", () => {
  const baseline = [{ quantity: 10, dailyUsage: 1, isEcoFriendly: false, isLocal: false, isRefurbished: false }];
  const ecoItems = [{ quantity: 10, dailyUsage: 1, isEcoFriendly: true, isLocal: true, isRefurbished: false }];
  const baseScore = sustainabilityScore(baseline);
  const ecoScore = sustainabilityScore(ecoItems);
  assert(ecoScore > baseScore, `Eco score (${ecoScore}) should be higher than base (${baseScore})`);
});

test("validateItem passes for valid input", () => {
  const form = { name: "Oat Milk", quantity: 10, dailyUsage: 2 };
  const errors = validateItem(form);
  assertEqual(Object.keys(errors).length, 0, "Expected no validation errors");
});

test("sustainabilityScore is capped at 100", () => {
  const items = Array(10).fill({ quantity: 10, dailyUsage: 1, isEcoFriendly: true, isLocal: true, isRefurbished: true });
  const score = sustainabilityScore(items);
  assert(score <= 100, `Score ${score} should not exceed 100`);
});

// ── Edge Case Tests ───────────────────────────────────────────────────────────
console.log("\n Edge Case Tests:");

test("daysUntilEmpty returns null when dailyUsage is 0", () => {
  const item = { quantity: 50, dailyUsage: 0 };
  assertEqual(daysUntilEmpty(item), null, "Expected null for zero usage rate");
});

test("daysUntilEmpty returns null when dailyUsage is missing", () => {
  const item = { quantity: 50 };
  assertEqual(daysUntilEmpty(item), null, "Expected null for missing usage rate");
});

test("daysUntilEmpty returns 0 for depleted item (not negative)", () => {
  const item = { quantity: 0, dailyUsage: 5 };
  assertEqual(daysUntilEmpty(item), 0, "Expected 0 days, not negative");
});

test("ruleBasedForecast shows 'depleted' message for 0 quantity", () => {
  const item = { name: "Sugar", quantity: 0, dailyUsage: 1 };
  const result = ruleBasedForecast(item);
  assert(result.includes("depleted") || result.includes("⚠️"), "Expected depletion message");
});

test("ruleBasedForecast returns no-data message with no usage rate", () => {
  const item = { name: "Laptop", quantity: 5, dailyUsage: 0 };
  const result = ruleBasedForecast(item);
  assert(result.includes("No usage data"), "Expected no-usage-data message");
});

test("validateItem catches missing name", () => {
  const form = { name: "", quantity: 10, dailyUsage: 1 };
  const errors = validateItem(form);
  assert(errors.name, "Expected name validation error");
});

test("validateItem catches negative quantity", () => {
  const form = { name: "Coffee", quantity: -5, dailyUsage: 1 };
  const errors = validateItem(form);
  assert(errors.quantity, "Expected quantity validation error for negative value");
});

test("validateItem catches non-numeric quantity", () => {
  const form = { name: "Coffee", quantity: "abc", dailyUsage: 1 };
  const errors = validateItem(form);
  assert(errors.quantity, "Expected quantity validation error for non-numeric value");
});

test("sustainabilityScore penalizes waste risk items", () => {
  // item that expires before running out = waste risk
  const wasteItem = [{ quantity: 100, dailyUsage: 1, expiryDays: 5, isEcoFriendly: false, isLocal: false, isRefurbished: false }];
  const normalItem = [{ quantity: 5, dailyUsage: 1, expiryDays: 30, isEcoFriendly: false, isLocal: false, isRefurbished: false }];
  const wasteScore = sustainabilityScore(wasteItem);
  const normalScore = sustainabilityScore(normalItem);
  assert(wasteScore < normalScore, `Waste risk score (${wasteScore}) should be lower than normal (${normalScore})`);
});

test("sustainabilityScore never goes below 0", () => {
  const items = Array(20).fill({ quantity: 100, dailyUsage: 1, expiryDays: 5, isEcoFriendly: false, isLocal: false, isRefurbished: false });
  const score = sustainabilityScore(items);
  assert(score >= 0, `Score ${score} should not be negative`);
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n─────────────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failed === 0) {
  console.log(`\nAll tests passed!\n`);
} else {
  console.log(`\n There are failed tests. Review above. \n`);
  process.exit(1);
}
