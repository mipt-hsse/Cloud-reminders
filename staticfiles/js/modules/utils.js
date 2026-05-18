
export function rgbToHex(rgb) {
  if (!rgb || rgb.startsWith('#')) return rgb;
  const result = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(rgb);
  if (!result) return '#000000';
  return '#' +
      ((1 << 24) + (parseInt(result[1]) << 16) + (parseInt(result[2]) << 8) +
       parseInt(result[3]))
          .toString(16)
          .slice(1)
          .toLowerCase();
}
