function generateRoundRobin(playerIds) {
  const ids = [...playerIds];
  const hasDummy = ids.length % 2 !== 0;
  if (hasDummy) ids.push("__DUMMY__");

  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;

  let arr = [...ids];
  const rawMatches = [];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];

      if (a !== "__DUMMY__" && b !== "__DUMMY__") {
        rawMatches.push({ a, b });
      }
    }
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return rawMatches;
}

console.log(generateRoundRobin(['akshat', 'harsh', 'adarsh', 'udbhaw']));
