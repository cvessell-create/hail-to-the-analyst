import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const chartRequire = createRequire(require.resolve("recharts"));
const { produce } = chartRequire("immer");
const { set, setWith, update, updateWith, zipObjectDeep } = chartRequire("es-toolkit/compat");

test("AIKIDO-2026-445255: chart and Redux use the pinned Immer and block prototype access", () => {
  const reduxRequire = createRequire(chartRequire.resolve("@reduxjs/toolkit"));
  assert.equal(chartRequire("immer/package.json").version, "11.1.9");
  assert.equal(reduxRequire("immer/package.json").version, "11.1.9");
  const key = "hailImmerSecurityFixture";
  try {
    assert.throws(() => produce({}, draft => { draft.constructor.prototype[key] = true; }));
    assert.equal(Object.prototype[key], undefined);
    assert.deepEqual(produce({ nested: { value: 1 } }, draft => { draft.nested.value = 2; }),
      { nested: { value: 2 } });
  } finally { delete Object.prototype[key]; }
});

test("AIKIDO-2026-523264: toolkit path writers reject prototype-polluting paths", () => {
  assert.equal(chartRequire("es-toolkit/package.json").version, "1.51.0");
  const key = "hailToolkitSecurityFixture";
  try {
    for (const prefix of ["constructor.prototype", "__proto__"]) {
      const property = `${prefix}.${key}`;
      set({}, property, true);
      setWith({}, property, true);
      update({}, property, () => true);
      updateWith({}, property, () => true);
      zipObjectDeep([property], [true]);
      assert.equal(Object.prototype[key], undefined);
    }
    assert.deepEqual(set({}, "nested.value", 2), { nested: { value: 2 } });
  } finally { delete Object.prototype[key]; }
});

test("upgraded Recharts renders a basic chart without changing its public component API", () => {
  const { createElement } = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { BarChart, Bar, XAxis } = require("recharts");
  const html = renderToStaticMarkup(createElement(BarChart, {
    width: 400, height: 300, data: [{ name: "fixture", value: 2 }],
  }, createElement(XAxis, { dataKey: "name" }), createElement(Bar, { dataKey: "value" })));
  assert.match(html, /recharts-wrapper/);
});
