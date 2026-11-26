/**
 * Every country a partner may apply from while partners are paid in RepGet
 * credits (PARTNER_PAYOUT_FORM unset or "credits").
 *
 * WHY. Applications were limited to the countries cash can be paid to
 * (PARTNER_PAYOUT_COUNTRIES, plus PayPal's), although no cash is paid at all
 * while commissions become credits. A partner in the United States could not
 * apply (Daniel, 2026-11-26: "we lose important opportunities"). Credits are
 * added to a RepGet workspace, which works from anywhere, so the country is
 * only where the partner is based.
 *
 * ISO 3166-1 alpha-2, without the countries under comprehensive EU / US / UN
 * sanctions (Cuba, Iran, North Korea, Syria). When cash payouts start
 * (PARTNER_PAYOUT_FORM=cash) the list is the payable countries again, and a
 * partner elsewhere is told payouts are not available there yet.
 */
const SANCTIONED = new Set(["CU", "IR", "KP", "SY"]);

const ISO_COUNTRIES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

export const CREDIT_PARTNER_COUNTRIES: readonly string[] = ISO_COUNTRIES.filter((code) => !SANCTIONED.has(code));
