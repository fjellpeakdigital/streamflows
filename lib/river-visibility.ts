const DISCOVERY_HIDDEN_STATION_IDS = new Set([
  '01055500',   // Nezinscot River at Turner Center, Maine
  '01064300',   // Presumpscot River
  '041275685',  // Clam Lake Outlet to Torch Lake Nr Alden, MI
  '04111000',   // Grand River near Eaton Rapids, MI
  '04102776',   // Middle Branch Black River near South Haven, MI
  '04044755',   // Miners River Nr Munising, MI
  '04127570',   // Torch River at County Road 593 at Torch River, MI
  '05104500',   // Roseau River below South Fork near Malung, MN
  '05288487',   // Sand Creek at Xeon Street in Coon Rapids, MN
  '01089925',   // Suncook River at NH 28, near Suncook, NH
  '04218601',   // Erie (barge) C Abv Halls Waste Weir at Lockport NY
  '04218700',   // Erie(barge)canal(w of Genesee R)at Rochester NY
  '04274185',   // White Brook near Wilmington NY
  '01446776',   // Bushkill Creek bl SR2017 bridge at Tatamy, PA
  '04087170',   // Milwaukee River at Mouth at Milwaukee, WI
  '04087234',   // Root River at 60th St near Caledonia, WI
]);

export function isSuppressedFromDiscovery(usgsStationId: string | null | undefined): boolean {
  if (!usgsStationId) return false;
  return DISCOVERY_HIDDEN_STATION_IDS.has(usgsStationId);
}

export function getSuppressedDiscoveryRiverCount(): number {
  return DISCOVERY_HIDDEN_STATION_IDS.size;
}
