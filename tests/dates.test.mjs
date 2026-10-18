import test from "node:test";
import assert from "node:assert/strict";
import {localISODate,displayDate} from "../src/utils/dates.js";
test("finance followups and cash ledger use the local calendar day",()=>{
 assert.equal(localISODate(new Date(2026,9,18,23,58)),"2026-10-18");
 assert.equal(localISODate(new Date(2026,9,19,0,2)),"2026-10-19");
});
test("date-only Firestore date strings do not shift to the previous calendar day",()=>{
 assert.equal(displayDate("2026-10-18"),"Oct 18, 2026");
 assert.equal(displayDate("2026-02-30"),"—");
 assert.equal(displayDate(""),"—");
});
