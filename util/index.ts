export function arraysEqual(a: Array<any>, b: Array<any>) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  // If you don't care about the order of the elements inside
  // the array, you should sort both arrays here.
  // Please note that calling sort on an array will modify that array.
  // you might want to clone your array first.

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export const getLastWord = (lines: string[]) => {
  const lastLine = lines[lines.length - 1];
  const words = lastLine.split(' ');
  return words[words.length - 1];
}

export function hasDuplicates(array: Array<any>) {
  return (new Set(array)).size !== array.length;
}

export const getTimePercentageClass = (timePercentageLeft: number) => {
  if (timePercentageLeft === 100) return 'w-full';
  return `w-[${Math.round(timePercentageLeft)}%]`;
}