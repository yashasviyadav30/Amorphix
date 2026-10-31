// How tightly "Look around" frames the building. The fit puts the building's longest side into the frame's height, so
// on a wide screen a long, narrow building (a shopfront café) sits small in a lot of empty space. Wider frames come in
// closer; a phone keeps the full margin so nothing is cut off.
export function fitMargin(aspect: number) {
  return aspect >= 2.4 ? 0.72 : aspect >= 1.6 ? 0.8 : aspect >= 1.2 ? 0.92 : 1.12;
}
