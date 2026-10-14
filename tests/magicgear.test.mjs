import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMagicWeapon, parseMagicArmor } from '../web/js/magicgear.js';

const entry = (name, desc, weight = '4 lbs.') => ({ id: 7, name, html: `<dl class="stat"><dt>Aura</dt><dd>strong evocation</dd><dt>Weight</dt><dd>${weight}</dd></dl><p>${desc}</p>` });

test('Flame Tongue: the enhancement, the burst ability and the base sword are read from "+1 flaming burst longsword"', () => {
  const w = parseMagicWeapon(entry('Flame Tongue', 'This is a <i>+1 flaming burst longsword</i>. Once per day, the sword can blast forth a fiery ray.'));
  assert.equal(w.enh, 1);
  assert.deepEqual(w.fx.map(f => f.id), ['flamingburst'], 'the burst, not plain flaming');
  assert.deepEqual([w.damage, w.crit, w.type, w.ranged, w.weight], ['1d8', '19-20/×2', 'S', false, 4]);
  assert.equal(w.name, 'Flame Tongue');
  assert.equal(w.id, 7);
});
test('several abilities, a two-handed weapon and a ranged one', () => {
  const w = parseMagicWeapon(entry('Sunblade-ish', 'A <i>+2 keen holy greatsword</i> that glows.', '8 lbs.'));
  assert.deepEqual(w.fx.map(f => f.id).sort(), ['holy', 'keen']);
  assert.equal(w.dmgMult, '1.5', 'greatsword is two-handed');
  assert.equal(w.damage, '2d6');
  const b = parseMagicWeapon(entry('Oathbow-ish', 'This <i>+2 composite longbow</i> ...', '3 lbs.'));
  assert.equal(b.ranged, true); assert.equal(b.range, '100 ft.'); assert.equal(b.enh, 2);
});
test('a weapon with no bonus in the text takes its base from the name, and a material from the start of the text', () => {
  const d = parseMagicWeapon(entry('Adamantine Dagger', 'This dagger is made of adamantine.', '1 lb.'));
  assert.equal(d.enh, 0); assert.equal(d.damage, '1d4'); assert.equal(d.material, 'adamantine');
});
test('something that is no weapon we know gives null', () => {
  assert.equal(parseMagicWeapon(entry('Bag of Holding', 'A bag that holds a great deal.')), null);
});

test('Armor of Insults: +1 studded leather', () => {
  const a = parseMagicArmor(entry('Armor Of Insults', 'Each metal bit of this suit of <i>+1 studded leather</i> looks like a tiny sneering face.', '20 lbs.'));
  assert.deepEqual([a.type, a.category, a.bonus, a.enh, a.maxDex, a.acp, a.asf, a.weight], ['armor', 'light', 3, 1, 5, -1, 15, 20]);
});
test('shadow and slick with grades: "+4 greater shadow greater slick leather armor"', () => {
  const a = parseMagicArmor(entry('Armor of the Shadow Lord', 'This suit of <i>+4 greater shadow greater slick leather</i> armor fits snugly.', '15 lbs.'));
  assert.equal(a.enh, 4);
  assert.deepEqual(a.fx.map(f => f.id).sort(), ['shadowgreat', 'slickgreat']);
});
test('a material armor with no bonus: Adamantine Breastplate', () => {
  const a = parseMagicArmor(entry('Adamantine Breastplate', 'This nonmagical breastplate is made of adamantine, giving its wearer damage reduction of 2/—.', '30 lbs.'));
  assert.equal(a.enh, 0); assert.equal(a.material, 'adamantine'); assert.equal(a.category, 'medium'); assert.equal(a.bonus, 5);
});
test('a shield: Darkwood Shield is a darkwood shield, never adamantine', () => {
  const s = parseMagicArmor(entry('Darkwood Shield', 'This wooden shield is made of darkwood.', '5 lbs.'));
  assert.equal(s.type, 'shield'); assert.equal(s.material, 'darkwood');
  assert.equal(parseMagicArmor(entry('Adamantine Shield', 'A heavy steel shield of adamantine.')).material, '');
});
test('a magic item that is no armor we know gives null', () => {
  assert.equal(parseMagicArmor(entry('Ring of Protection +1', 'A ring.')), null);
});
