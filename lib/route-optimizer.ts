import type { Spot } from "./trip-types";

export function distance(a: Spot, b: Spot) {
  const dx = (a.x - b.x) * 88;
  const dy = (a.y - b.y) * 111;
  return Math.sqrt(dx * dx + dy * dy);
}

export function routeDistance(spots: Spot[]) {
  return spots.slice(0, -1).reduce((sum, spot, index) => sum + distance(spot, spots[index + 1]), 0);
}

export function optimizeRoute(spots: Spot[]) {
  if (spots.length < 3) return spots;
  const remaining = spots.slice(1);
  const route = [spots[0]];

  while (remaining.length) {
    const current = route[route.length - 1];
    let nearestIndex = 0;
    for (let index = 1; index < remaining.length; index += 1) {
      if (distance(current, remaining[index]) < distance(current, remaining[nearestIndex])) nearestIndex = index;
    }
    route.push(remaining.splice(nearestIndex, 1)[0]);
  }

  let improved = true;
  while (improved) {
    improved = false;
    for (let startIndex = 1; startIndex < route.length - 1; startIndex += 1) {
      for (let endIndex = startIndex + 1; endIndex < route.length; endIndex += 1) {
        const candidate = [...route.slice(0, startIndex), ...route.slice(startIndex, endIndex + 1).reverse(), ...route.slice(endIndex + 1)];
        if (routeDistance(candidate) < routeDistance(route)) {
          route.splice(0, route.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return route;
}
