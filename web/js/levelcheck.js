// What a character still has left undone when they apply a level (or finish creating a character).
// Pure: the wizard passes in the numbers, this returns plain sentences for the warning window.

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function levelWarnings(x) {
  const out = [];
  const unspent = x.rankBudget - x.ranksUsed;
  if (unspent > 0) out.push(`${plural(unspent, 'skill rank')} not assigned yet (you have ${x.rankBudget} this level and used ${x.ranksUsed}).`);
  const feats = (x.getsFeat ? 1 : 0) + (x.bonusFeat ? 1 : 0);
  if (feats > (x.featsChosen || 0)) out.push(`${plural(feats - (x.featsChosen || 0), 'feat')} not chosen yet.`);
  if (x.traitsLeft > 0) out.push(`${plural(x.traitsLeft, 'trait')} not chosen yet.`);
  if (x.getsAbility && !x.abilityIncrease) out.push('No ability score increase chosen for this level.');
  if (x.isFav) {
    if (x.fcb === 'racial' && !x.fcbNote) out.push('Favored class bonus: no racial option picked.');
    else if (x.fcb === 'other' && !String(x.fcbNote || '').trim()) out.push('Favored class bonus: your own bonus is blank.');
  }
  if (x.spellsLeft) out.push(`${x.spellsLeft} still to choose.`);
  if (x.newLevel === 1) {
    if (x.pointsLeft > 0) out.push(`${plural(x.pointsLeft, 'ability point-buy point')} not spent.`);
    if (x.pointsLeft < 0) out.push(`Ability scores are ${plural(-x.pointsLeft, 'point')} over the point-buy budget.`);
    if (!String(x.name || '').trim() || x.name === 'New Character') out.push('The character still has the default name.');
  }
  return out;
}
