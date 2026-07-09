export function isAtLeastMinutesApart(startTime, endTime, minutes) {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return end - start >= minutes * 60 * 1000;
}
