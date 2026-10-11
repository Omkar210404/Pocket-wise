/**
 * DEMO DATA LAYER. Fills a `DemoDb` with FICTIONAL expenses for one made-up
 * account. Every name, shop and amount here is invented. The data is generated
 * from a fixed seed per month, so the same month always looks the same, and it
 * is dated relative to today, so "this month" is never empty.
 */

import type { PaymentMethod } from '@/api/types';
import { addMonths, currentMonth, daysInMonth, toIsoDate } from '@/lib/dates';

import type { DemoDb } from './db';

/** The demo account. Not a secret: it exists only in the browser's memory. */
export const DEMO_EMAIL = 'demo@example.com';
export const DEMO_PASSWORD = 'demo-ledger';

const MONTHS_OF_HISTORY = 6;

/** A small seeded random number generator (mulberry32). Same seed, same numbers. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Template {
  note: string;
  /** Whole currency units, smallest and largest. */
  range: [number, number];
  method: PaymentMethod;
}

const MEALS: Template[] = [
  { note: 'Lunch at Saffron Table', range: [220, 480], method: 'upi' },
  { note: 'Coffee, Blue Kettle', range: [140, 260], method: 'upi' },
  { note: 'Dinner with friends', range: [600, 1400], method: 'card' },
  { note: 'Bakery, Rise & Crumb', range: [120, 340], method: 'cash' },
  { note: 'Tiffin for the week', range: [650, 900], method: 'upi' },
];

const RIDES: Template[] = [
  { note: 'Auto to the station', range: [40, 120], method: 'cash' },
  { note: 'Auto to the station', range: [40, 120], method: 'upi' },
  { note: 'Cab home, late evening', range: [220, 460], method: 'wallet' },
];

const SHOPPING: Template[] = [
  { note: 'Running shoes', range: [2400, 3800], method: 'card' },
  { note: 'Phone case', range: [299, 499], method: 'upi' },
  { note: 'Stationery', range: [150, 420], method: 'cash' },
  { note: 'Desk lamp', range: [700, 1200], method: 'card' },
  { note: 'Cotton kurta', range: [900, 1800], method: 'card' },
];

/** Budgets for the budgeted categories. Health, Education and Other are left without one on purpose. */
const BUDGETS: Record<string, number> = {
  Food: 9000,
  Transport: 2500,
  Housing: 19000,
  Utilities: 3200,
  Entertainment: 1500,
  Shopping: 4000,
};

const pad = (value: number) => String(value).padStart(2, '0');

export function seedDemoDb(db: DemoDb, now: Date = new Date()): void {
  const user = db.register(DEMO_EMAIL, DEMO_PASSWORD);
  const categoryId = new Map(db.listCategories(user.id).map((c) => [c.name, c.id]));
  const today = toIsoDate(now);
  const thisMonth = currentMonth(now);

  for (let back = MONTHS_OF_HISTORY - 1; back >= 0; back -= 1) {
    const month = addMonths(thisMonth, -back);
    const [year = 0, monthNumber = 1] = month.split('-').map(Number);
    const random = seededRandom(year * 12 + monthNumber);
    const lastDay = daysInMonth(month);

    const between = (min: number, max: number) => Math.round(min + random() * (max - min));
    const chance = (probability: number) => random() < probability;
    const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)] as T;
    const day = () => between(1, lastDay);

    const add = (
      category: string,
      dayOfMonth: number,
      units: number,
      note: string,
      method: PaymentMethod,
      paise = 0,
    ) => {
      const date = `${month}-${pad(Math.min(dayOfMonth, lastDay))}`;
      // The current month only has expenses up to today.
      if (date > today) return;
      db.insertExpense(
        user.id,
        {
          category_id: categoryId.get(category) ?? 0,
          amount_minor: units * 100 + paise,
          date,
          note,
          payment_method: method,
        },
        `${date}T12:00:00.000Z`,
      );
    };
    const addFrom = (category: string, template: Template, dayOfMonth: number) =>
      add(
        category,
        dayOfMonth,
        between(...template.range),
        template.note,
        template.method,
        chance(0.3) ? 50 : 0,
      );

    add('Housing', 1, 18500, 'Rent for the flat', 'bank_transfer');

    add('Utilities', 5, 799, 'Broadband plan', 'card');
    add('Utilities', 8, between(1350, 2150), 'Electricity bill', 'upi');
    add('Utilities', 12, 299, 'Mobile recharge', 'upi');

    for (const groceryDay of [3, 10, 17, 24]) {
      add(
        'Food',
        groceryDay + between(0, 2),
        between(900, 2100),
        'Groceries, Greenleaf Market',
        chance(0.5) ? 'upi' : 'card',
        chance(0.5) ? 50 : 0,
      );
    }
    for (let i = between(8, 12); i > 0; i -= 1) addFrom('Food', pick(MEALS), day());

    add('Transport', 2, 500, 'Metro card top-up', 'upi');
    add('Transport', 16, 300, 'Metro card top-up', 'upi');
    for (let i = between(6, 10); i > 0; i -= 1) addFrom('Transport', pick(RIDES), day());

    if (chance(0.6)) add('Health', day(), between(180, 720), 'Pharmacy', 'upi');
    if (chance(0.25)) add('Health', day(), between(500, 900), 'Clinic visit', 'card');

    add('Entertainment', 6, 499, 'Streaming subscription', 'card');
    for (let i = between(1, 2); i > 0; i -= 1) {
      add('Entertainment', day(), between(320, 640), 'Movie tickets', 'upi');
    }
    // One clear over-budget case in the current month, so that state is on show.
    if (back === 0) add('Entertainment', 4, 1800, 'Concert tickets', 'card');

    for (let i = between(1, 3); i > 0; i -= 1) addFrom('Shopping', pick(SHOPPING), day());

    if (chance(0.45)) add('Education', 15, 1499, 'Online course, data analysis', 'card');
    if (chance(0.5)) add('Education', day(), between(350, 1100), 'Books', 'card');

    if (chance(0.5)) add('Other', day(), between(500, 1500), 'Gift for a friend', 'upi');
    if (chance(0.6)) add('Other', day(), between(200, 350), 'Haircut', 'cash');

    // Budgets do not carry over on the backend, so only recent months have them.
    if (back <= 2) {
      for (const [category, units] of Object.entries(BUDGETS)) {
        db.createBudget(user.id, {
          category_id: categoryId.get(category) ?? 0,
          month,
          amount_minor: units * 100,
        });
      }
    }
  }
}
