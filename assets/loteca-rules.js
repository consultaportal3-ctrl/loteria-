(() => {
  const size = mask => [1,2,4].filter(bit => mask & bit).length;
  const summary = picks => {
    const doubles = picks.filter(mask => size(mask) === 2).length;
    const triples = picks.filter(mask => size(mask) === 3).length;
    return {filled:picks.filter(Boolean).length,doubles,triples,combinations:2 ** doubles * 3 ** triples};
  };
  const withinLimit = picks => {
    const {doubles,triples} = summary(picks);
    return triples <= 6 && doubles <= [9,8,6,5,3,1,0][triples];
  };
  const valid = (picks, contest) => Array.isArray(picks) && picks.length === 14 && picks.every(mask => Number.isInteger(mask) && mask >= 1 && mask <= 7) && summary(picks).filled === 14 && contest === window.lotecaData.contest && withinLimit(picks) && summary(picks).combinations >= 2;
  const labels = picks => picks.map((mask,i) => `${String(i+1).padStart(2,'0')}: ${[1,2,4].flatMap((bit,j) => mask & bit ? [['1','X','2'][j]] : []).join(' / ')}`);
  window.lotecaRules = {size,summary,withinLimit,valid,labels,price:picks => 2 * summary(picks).combinations};
})();
