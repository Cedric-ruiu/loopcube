import {
	BufferGeometry,
	DoubleSide,
	EdgesGeometry,
	Float32BufferAttribute,
	Group,
	LineBasicMaterial,
	LineSegments,
	Mesh,
	MeshBasicMaterial,
	Shape,
	ShapeGeometry,
	Vector2,
	Vector3,
} from "three";
import { FIGURE } from "./palette";

export const HUMAN_HEIGHT = 1820;
/** Height the outlines below are drawn at, in mm */
const DRAWN_HEIGHT = 1750;
const SCALE = HUMAN_HEIGHT / DRAWN_HEIGHT;
const HALF_WIDTH = 330 * SCALE;
const CLEARANCE = 200;
const SIDE = new Vector3(1, 0, -1).normalize();
const STEPS = 8;
const RIM = 16;
const JOIN_TURN = 0.2;
const JOIN_STEPS = 12;

type Color = keyof typeof FIGURE;
/** A third value makes the point a corner; when not empty, it names it for the areas. */
type Point = readonly [number, number] | readonly [number, number, string];
/** Part of the outline or of a gap, from one named corner to another, clockwise */
type Span = readonly [string, string];
/** A closed shape of its own, or spans and points joined in turn */
type Area =
	| { ink: Color; shape: readonly Point[] }
	| { ink: Color; path: readonly (Span | Point)[] };

/**
 * Crew member in an olive flight suit and high-top sneakers, sleeves pushed
 * up, one hand on the hip, weight on the left leg, seen from the front: x to
 * the person's left, height above the floor, in mm. Head and hair follow a
 * full-length photo of the character. Runs clockwise from the top of the hair,
 * through a smooth curve between the corners.
 */
// biome-ignore format: one point per line would hide the outline
const OUTLINE: readonly Point[] = [
	// Hair from the top, head slightly tilted: curls down to the shoulder on this side
	[30, 1746], [45, 1742], [63, 1741], [85, 1744, ""], [103, 1734, ""], [115, 1722, ""],
	[126, 1706], [141, 1699, ""], [147, 1683], [152, 1669], [158, 1654], [166, 1642],
	[182, 1632, ""], [180, 1616], [193, 1605, ""], [185, 1588], [188, 1574], [202, 1562, ""],
	[194, 1546], [195, 1531], [190, 1517], [191, 1501], [198, 1484, ""], [186, 1473],
	[179, 1459], [177, 1445], [181, 1431], [193, 1420, ""], [184, 1405], [184, 1398, "hairR"],
	// Shoulder and hanging arm, sleeve pushed up, hand resting on the thigh
	[198, 1388], [214, 1364], [226, 1326], [234, 1270], [238, 1210], [244, 1150],
	[250, 1096], [257, 1070, "rollRb"], [266, 1042], [260, 1012, "rollRa"], [249, 980], [241, 930],
	[233, 880], [226, 858], [231, 830], [232, 796], [228, 764], [220, 738],
	[208, 722], [196, 722], [188, 734], [182, 756], [180, 768, "hipR"],
	// Straight leg, high-top sneaker
	[174, 700], [170, 660], [164, 560], [158, 460], [154, 360], [150, 270],
	[150, 220], [156, 196], [150, 180, "shoeRo"], [154, 150], [158, 118], [164, 90],
	[172, 64], [178, 40], [178, 22, "soleRo"], [176, 6], [168, 0, ""], [44, 0, ""],
	[36, 6], [34, 20, "soleRi"], [34, 50], [36, 90], [38, 130], [40, 180, "shoeRi"],
	[34, 198], [38, 230], [36, 300], [36, 380], [36, 480], [34, 580],
	[30, 680], [22, 760], [10, 792, ""],
	// Relaxed leg, knee bent inwards, sneaker turned out
	[-4, 772], [-10, 690], [-14, 590], [-20, 500], [-34, 420], [-56, 320],
	[-72, 236], [-76, 204], [-80, 184, "shoeLi"], [-82, 150], [-84, 116], [-88, 80],
	[-94, 48], [-96, 22, "soleLi"], [-102, 6], [-112, 0, ""], [-212, 0, ""], [-224, 8],
	[-222, 24, "soleLo"], [-210, 46], [-194, 76], [-184, 108], [-178, 140], [-176, 184, "shoeLo"],
	[-182, 204], [-170, 240], [-160, 300], [-142, 380], [-130, 480], [-140, 570],
	[-156, 650], [-166, 750], [-172, 850], [-174, 920], [-170, 950],
	// Hand on the hip, forearm, elbow, upper arm and shoulder
	[-166, 962, "handLb"], [-180, 964], [-194, 970], [-208, 984], [-220, 1002], [-249, 1041],
	[-277, 1074, "rollLa"], [-296, 1090], [-298, 1094, "rollLb"], [-311, 1113], [-320, 1136], [-318, 1156],
	[-306, 1188], [-290, 1236], [-274, 1290], [-256, 1340], [-240, 1374], [-222, 1398],
	[-198, 1414], [-170, 1422], [-140, 1426], [-104, 1428], [-82, 1428],
	// Hair: thin strand along the neck, mass ending at the jaw, back to the top
	[-70, 1424, "hairL"], [-66, 1446, ""], [-50, 1465], [-48, 1477], [-49, 1488], [-61, 1504],
	[-80, 1516], [-82, 1539], [-94, 1551, ""], [-84, 1562], [-85, 1585], [-93, 1605],
	[-99, 1621, ""], [-94, 1632, ""], [-91, 1656, ""], [-79, 1675, ""], [-61, 1692], [-52, 1715, ""],
	[-37, 1719], [-27, 1728], [-19, 1743, ""], [-2, 1744], [15, 1742],
];

/** Closed by the arms: parts of the sign, not holes. */
// biome-ignore format: one point per line would hide the outline
const GAPS: readonly (readonly Point[])[] = [
	// Between the arm on the hip and the waist
	[
		[-246, 1146, "elbowLi"], [-237, 1131, "rollLc"], [-226, 1114, "rollLd"], [-210, 1090], [-192, 1062], [-174, 1040],
		[-160, 1040, "handLt"], [-146, 1070], [-142, 1120], [-148, 1180], [-156, 1240], [-166, 1294, ""],
		[-190, 1282], [-210, 1246], [-226, 1206], [-238, 1172],
	],
	// Between the hanging arm and the waist, closed by the hand on the thigh
	[
		[189, 906, "hipRg"], [186, 940], [182, 980], [180, 1008, "rollRd"], [178, 1040], [176, 1070, "rollRc"],
		[176, 1140], [174, 1210], [170, 1270], [168, 1296, ""], [168, 1250], [160, 1190],
		[150, 1140], [144, 1100], [152, 1050], [168, 996], [180, 950],
	],
];

/** Painted over the suit, back to front. */
// biome-ignore format: one point per line would hide the shapes
const AREAS: readonly Area[] = [
	// Hair
	{ ink: "hair", path: [["hairL", "hairR"], [150, 1404], [100, 1414], [60, 1424], [30, 1444], [20, 1490], [-4, 1490], [-12, 1440], [-20, 1422]] },
	// Shadow of the hair around the face
	{ ink: "curl", shape: [
		[-16, 1688], [11, 1687], [30, 1681], [50, 1671], [63, 1662], [72, 1649],
		[75, 1630], [80, 1610], [81, 1590], [74, 1570], [63, 1551], [54, 1531],
		[42, 1513], [26, 1501], [3, 1494], [-13, 1499], [-28, 1512], [-39, 1530],
		[-48, 1550], [-51, 1574], [-52, 1597], [-50, 1617], [-50, 1636], [-45, 1657],
		[-37, 1673], [-27, 1683],
	] },
	// Neck and the undershirt in the deep open collar
	{ ink: "shade", shape: [
		[-34, 1418, ""], [-26, 1446], [-17, 1475], [-11, 1507], [41, 1504], [47, 1472],
		[52, 1442], [58, 1415, ""], [42, 1402], [23, 1392], [7, 1390], [-11, 1394],
		[-24, 1405],
	] },
	{ ink: "shirt", shape: [
		[-48, 1430, ""], [-30, 1404], [-16, 1394], [2, 1390], [18, 1394], [36, 1406],
		[52, 1428, ""], [8, 1300, ""],
	] },
	// Face, left blank: the part the hair leaves visible, and a curl on the forehead
	{ ink: "skin", shape: [
		[-10, 1681], [12, 1681], [28, 1675], [43, 1666], [55, 1658], [62, 1645],
		[64, 1627], [68, 1609], [69, 1591], [63, 1571], [54, 1554], [47, 1535],
		[37, 1519], [23, 1507], [5, 1500, ""], [-9, 1505], [-21, 1517], [-30, 1533],
		[-37, 1552], [-40, 1575], [-40, 1597], [-38, 1615], [-39, 1633], [-34, 1652],
		[-28, 1667], [-19, 1677],
	] },
	{ ink: "hair", shape: [
		[-24, 1682], [-9, 1691], [4, 1687], [10, 1672], [5, 1660], [-5, 1663],
		[-8, 1673], [-16, 1672],
	] },
	// Collar
	{ ink: "flap", shape: [[52, 1428, ""], [96, 1414, ""], [40, 1326, ""], [8, 1300, ""]] },
	{ ink: "flap", shape: [[-48, 1430, ""], [-92, 1422, ""], [-36, 1332, ""], [8, 1300, ""]] },
	// Forearms and hands
	{ ink: "skin", path: [["rollRa", "hipR"], ["hipRg", "rollRd"]] },
	{ ink: "skin", path: [["handLb", "rollLa"], ["rollLd", "handLt"], [-146, 1012], [-150, 988], [-158, 970]] },
	// Pushed-up sleeves
	{ ink: "fold", path: [["rollRb", "rollRa"], ["rollRd", "rollRc"]] },
	{ ink: "fold", path: [["rollLa", "rollLb"], ["rollLc", "rollLd"]] },
	// High-top sneakers and their soles
	{ ink: "shoe", path: [["shoeRo", "shoeRi"]] },
	{ ink: "shoe", path: [["shoeLi", "shoeLo"]] },
	{ ink: "sole", path: [["soleRo", "soleRi"]] },
	{ ink: "sole", path: [["soleLi", "soleLo"]] },
	// Chest pocket flaps and name tape
	{ ink: "flap", shape: [[40, 1302, ""], [126, 1298, ""], [124, 1266, ""], [82, 1260], [42, 1270, ""]] },
	{ ink: "flap", shape: [[-32, 1312, ""], [-118, 1314, ""], [-116, 1282, ""], [-74, 1274], [-34, 1280, ""]] },
	{ ink: "shirt", shape: [[44, 1338, ""], [120, 1334, ""], [120, 1314, ""], [44, 1318, ""]] },
	// Thigh pocket flaps
	{ ink: "flap", shape: [[108, 760, ""], [166, 760, ""], [164, 728, ""], [108, 728, ""]] },
	{ ink: "flap", shape: [[-104, 770, ""], [-160, 770, ""], [-158, 738, ""], [-102, 738, ""]] },
	// Shoulder patches, plain
	{ ink: "patch", shape: [
		[216, 1342], [228, 1326], [226, 1304], [212, 1290], [196, 1292], [186, 1308],
		[188, 1330], [200, 1342],
	] },
	{ ink: "badge", shape: [
		[210, 1324], [214, 1316], [212, 1308], [206, 1304], [198, 1306], [196, 1314],
		[200, 1322],
	] },
	{ ink: "patch", shape: [
		[-216, 1376], [-200, 1364], [-198, 1342], [-210, 1326], [-228, 1326], [-240, 1340],
		[-240, 1362], [-230, 1374],
	] },
	{ ink: "badge", shape: [
		[-216, 1360], [-210, 1352], [-212, 1344], [-218, 1340], [-226, 1342], [-228, 1350],
		[-224, 1358],
	] },
];

// biome-ignore format: one point per line would hide the lines
const LINES: readonly (readonly [Color, readonly Point[]])[] = [
	// Zip, sleeves, waist and pockets
	["seam", [[8, 1300], [4, 1086], [10, 792]]],
	["seam", [[176, 1400], [172, 1350], [174, 1300]]],
	["seam", [[-196, 1412], [-178, 1352], [-166, 1294]]],
	["seam", [[-142, 1076], [4, 1086], [144, 1100]]],
	["seam", [[42, 1270], [44, 1172], [122, 1168], [124, 1266]]],
	["seam", [[-34, 1280], [-36, 1182], [-114, 1184], [-116, 1282]]],
	["seam", [[108, 728], [110, 620], [162, 620], [164, 728]]],
	["seam", [[-102, 738], [-106, 630], [-154, 630], [-158, 738]]],
	// Shin pockets and gathered cuffs
	["seam", [[62, 430], [140, 430], [138, 300], [60, 300], [62, 430]]],
	["seam", [[-132, 430], [-46, 430], [-58, 300], [-146, 300], [-132, 430]]],
	["seam", [[38, 214], [152, 214]]],
	["seam", [[-74, 218], [-180, 220]]],
	// Laces and toe caps
	["lace", [[64, 150], [124, 150]]],
	["lace", [[66, 124], [128, 124]]],
	["lace", [[68, 98], [132, 98]]],
	["lace", [[40, 46], [104, 30], [172, 46]]],
	["lace", [[-112, 150], [-160, 150]]],
	["lace", [[-112, 124], [-164, 124]]],
	["lace", [[-116, 98], [-170, 98]]],
	["lace", [[-96, 40], [-150, 26], [-212, 30]]],
	// Curls and light in the hair
	["curl", [[-55, 1504], [-55, 1498], [-49, 1495], [-43, 1496], [-39, 1501]]],
	["curl", [[109, 1650], [112, 1658], [108, 1665], [100, 1666], [93, 1662]]],
	["curl", [[65, 1453], [68, 1462], [76, 1465], [84, 1462], [85, 1453]]],
	["curl", [[54, 1745], [49, 1741], [47, 1736], [49, 1730], [54, 1727]]],
	["curl", [[112, 1573], [114, 1566], [120, 1562], [127, 1562], [132, 1567]]],
	["curl", [[-79, 1590], [-73, 1598], [-76, 1608], [-85, 1612], [-95, 1610]]],
	["curl", [[66, 1722], [60, 1721], [56, 1716], [57, 1710], [61, 1705]]],
	["curl", [[94, 1606], [87, 1608], [84, 1613], [83, 1620], [87, 1626]]],
	["curl", [[142, 1654], [143, 1659], [148, 1663], [153, 1663], [158, 1658]]],
	["curl", [[79, 1520], [86, 1521], [91, 1527], [93, 1535], [88, 1541]]],
	["curl", [[66, 1737], [63, 1747], [54, 1749], [46, 1744], [45, 1735]]],
	["curl", [[143, 1440], [135, 1435], [127, 1438], [123, 1446], [126, 1454]]],
	["curl", [[146, 1523], [145, 1531], [140, 1536], [132, 1537], [125, 1532]]],
	["curl", [[125, 1447], [124, 1451], [121, 1454], [117, 1455], [113, 1454]]],
	["curl", [[149, 1464], [146, 1473], [140, 1477], [131, 1476], [125, 1468]]],
	["curl", [[121, 1462], [124, 1453], [119, 1444], [110, 1443], [102, 1449]]],
	["curl", [[142, 1495], [137, 1492], [135, 1487], [137, 1482], [141, 1478]]],
	["curl", [[92, 1706], [86, 1701], [79, 1703], [76, 1707], [75, 1714]]],
	["curl", [[111, 1597], [113, 1604], [118, 1606], [125, 1605], [129, 1600]]],
	["curl", [[166, 1438], [164, 1442], [160, 1444], [155, 1443], [152, 1440]]],
	["curl", [[64, 1670], [70, 1677], [80, 1677], [87, 1670], [87, 1661]]],
	["curl", [[98, 1567], [101, 1558], [109, 1555], [117, 1558], [118, 1567]]],
	["curl", [[98, 1544], [101, 1539], [99, 1533], [94, 1531], [88, 1531]]],
	["curl", [[100, 1431], [100, 1425], [102, 1420], [106, 1417], [112, 1416]]],
	["curl", [[64, 1526], [66, 1515], [60, 1506], [49, 1506], [42, 1514]]],
	["curl", [[124, 1510], [124, 1503], [128, 1499], [135, 1499], [138, 1504]]],
	["curl", [[134, 1490], [141, 1489], [146, 1484], [148, 1478], [146, 1471]]],
	["curl", [[146, 1451], [139, 1457], [129, 1457], [123, 1449], [125, 1439]]],
	["curl", [[46, 1719], [45, 1711], [37, 1707], [30, 1708], [25, 1715]]],
	["curl", [[194, 1496], [189, 1493], [183, 1493], [179, 1497], [179, 1503]]],
	["curl", [[55, 1715], [59, 1719], [59, 1724], [57, 1728], [52, 1730]]],
	["curl", [[68, 1718], [76, 1719], [83, 1714], [86, 1706], [83, 1699]]],
	["curl", [[4, 1684], [11, 1680], [18, 1683], [23, 1689], [22, 1697]]],
	["curl", [[159, 1549], [164, 1548], [168, 1550], [171, 1555], [169, 1560]]],
	["curl", [[89, 1650], [91, 1647], [92, 1642], [90, 1638], [86, 1636]]],
	["curl", [[-22, 1731], [-18, 1725], [-10, 1721], [-3, 1723], [3, 1730]]],
	["curl", [[91, 1439], [96, 1444], [96, 1452], [93, 1459], [86, 1462]]],
	["curl", [[132, 1660], [140, 1657], [144, 1651], [142, 1644], [136, 1640]]],
	["curl", [[173, 1608], [167, 1607], [162, 1610], [159, 1616], [160, 1623]]],
	["curl", [[145, 1594], [138, 1601], [140, 1611], [147, 1617], [156, 1615]]],
	["curl", [[163, 1437], [156, 1440], [153, 1446], [155, 1453], [161, 1457]]],
	["curl", [[152, 1505], [144, 1503], [139, 1495], [140, 1487], [148, 1482]]],
	["curl", [[143, 1621], [138, 1625], [132, 1628], [126, 1625], [123, 1619]]],
	["curl", [[108, 1650], [101, 1653], [94, 1651], [90, 1645], [91, 1637]]],
	["curl", [[103, 1636], [106, 1630], [111, 1628], [118, 1630], [121, 1634]]],
	["curl", [[57, 1525], [59, 1528], [63, 1530], [68, 1529], [71, 1525]]],
	["curl", [[168, 1460], [172, 1450], [181, 1448], [189, 1454], [191, 1462]]],
	["curl", [[-10, 1715], [-12, 1720], [-17, 1724], [-22, 1724], [-27, 1721]]],
	["curl", [[95, 1557], [101, 1561], [109, 1561], [115, 1556], [115, 1549]]],
	["curl", [[150, 1410], [143, 1408], [137, 1410], [133, 1416], [134, 1422]]],
	["curl", [[23, 1753], [19, 1746], [20, 1739], [25, 1735], [33, 1734]]],
	["curl", [[149, 1502], [146, 1507], [147, 1512], [152, 1516], [158, 1514]]],
	["curl", [[27, 1719], [18, 1720], [11, 1726], [12, 1735], [18, 1742]]],
	["curl", [[99, 1440], [99, 1431], [106, 1426], [115, 1426], [120, 1434]]],
	["curl", [[60, 1724], [53, 1725], [47, 1721], [45, 1715], [47, 1708]]],
	["curl", [[87, 1524], [92, 1528], [99, 1527], [104, 1523], [106, 1517]]],
	["curl", [[-84, 1587], [-79, 1581], [-71, 1578], [-64, 1582], [-61, 1590]]],
	["curl", [[-70, 1547], [-65, 1545], [-63, 1541], [-64, 1536], [-68, 1533]]],
	["curl", [[-13, 1736], [-11, 1741], [-6, 1743], [0, 1742], [3, 1736]]],
	["curl", [[-56, 1554], [-48, 1561], [-49, 1571], [-56, 1577], [-66, 1574]]],
	["curl", [[110, 1631], [115, 1637], [123, 1638], [130, 1633], [131, 1625]]],
	["curl", [[91, 1581], [96, 1583], [99, 1587], [100, 1592], [97, 1598]]],
	["curl", [[166, 1578], [159, 1575], [156, 1568], [161, 1562], [168, 1562]]],
	["curl", [[170, 1632], [165, 1631], [161, 1627], [161, 1622], [165, 1618]]],
	["curl", [[100, 1472], [93, 1477], [90, 1485], [92, 1493], [100, 1496]]],
	["curl", [[125, 1492], [133, 1489], [136, 1480], [131, 1474], [123, 1472]]],
	["curl", [[187, 1583], [192, 1580], [194, 1574], [192, 1570], [186, 1567]]],
	["curl", [[181, 1473], [187, 1468], [187, 1460], [180, 1455], [173, 1456]]],
	["curl", [[119, 1524], [120, 1519], [118, 1515], [113, 1514], [108, 1514]]],
	["curl", [[110, 1439], [106, 1432], [108, 1425], [114, 1420], [121, 1420]]],
	["gloss", [[35, 1699], [41, 1701], [43, 1705], [43, 1712], [39, 1715]]],
	["gloss", [[-74, 1577], [-73, 1582], [-75, 1587], [-79, 1589], [-83, 1589]]],
	["gloss", [[11, 1724], [15, 1726], [18, 1730], [16, 1735], [12, 1736]]],
	["gloss", [[-78, 1633], [-78, 1628], [-74, 1624], [-68, 1624], [-65, 1629]]],
	["gloss", [[41, 1708], [42, 1713], [47, 1715], [52, 1714], [55, 1709]]],
	["gloss", [[28, 1707], [28, 1702], [24, 1699], [19, 1699], [15, 1703]]],
	["gloss", [[-3, 1728], [-1, 1725], [4, 1724], [8, 1725], [11, 1730]]],
	["gloss", [[-66, 1607], [-71, 1608], [-74, 1611], [-74, 1616], [-72, 1619]]],
	["gloss", [[59, 1690], [63, 1686], [65, 1680], [63, 1675], [59, 1672]]],
	["gloss", [[29, 1706], [24, 1705], [21, 1708], [18, 1713], [19, 1718]]],
	["gloss", [[-37, 1703], [-29, 1701], [-24, 1706], [-22, 1713], [-27, 1718]]],
	["gloss", [[-64, 1615], [-60, 1613], [-55, 1613], [-51, 1617], [-50, 1623]]],
	["gloss", [[-73, 1663], [-77, 1670], [-74, 1677], [-67, 1679], [-60, 1677]]],
	["gloss", [[63, 1737], [68, 1730], [65, 1723], [58, 1720], [51, 1722]]],
	["gloss", [[60, 1724], [55, 1722], [53, 1718], [55, 1713], [59, 1711]]],
	["gloss", [[63, 1703], [60, 1698], [61, 1693], [66, 1688], [72, 1688]]],
	["gloss", [[44, 1733], [51, 1729], [52, 1721], [47, 1715], [40, 1716]]],
	["gloss", [[-76, 1621], [-82, 1624], [-84, 1631], [-81, 1637], [-74, 1641]]],
];

interface Curve {
	points: Vector2[];
	corners: Map<string, number>;
}

/** Samples a closed outline as cubic Béziers with Catmull-Rom tangents, none at corners. */
function sample(outline: readonly Point[]): Curve {
	const n = outline.length;
	const at = (i: number) => outline[(i + n) % n] ?? [0, 0];
	const tangent = (i: number) => {
		if (at(i).length === 3) return new Vector2();
		const [a, b] = [at(i - 1), at(i + 1)];
		return new Vector2((b[0] - a[0]) / 6, (b[1] - a[1]) / 6);
	};
	const points: Vector2[] = [];
	const corners = new Map<string, number>();
	for (let i = 0; i < n; i++) {
		const b = at(i);
		const c = at(i + 1);
		if (b[2]) corners.set(b[2], points.length);
		const start = new Vector2(b[0], b[1]);
		const end = new Vector2(c[0], c[1]);
		const c1 = start.clone().add(tangent(i));
		const c2 = end.clone().sub(tangent(i + 1));
		for (let k = 0; k < STEPS; k++) {
			const t = k / STEPS;
			const u = 1 - t;
			points.push(
				start
					.clone()
					.multiplyScalar(u * u * u)
					.addScaledVector(c1, 3 * u * u * t)
					.addScaledVector(c2, 3 * u * t * t)
					.addScaledVector(end, t * t * t),
			);
		}
	}
	return { points, corners };
}

function span(curves: readonly Curve[], [from, to]: Span): Vector2[] {
	const curve = curves.find((c) => c.corners.has(from));
	if (!curve) throw new RangeError(`No corner ${from}`);
	const { points, corners } = curve;
	const last = corners.get(to);
	if (last === undefined) throw new RangeError(`No corner ${to}`);
	const part: Vector2[] = [];
	for (let i = corners.get(from) ?? 0; ; i = (i + 1) % points.length) {
		part.push(points[i] ?? new Vector2());
		if (i === last) return part;
	}
}

const isSpan = (entry: Span | Point): entry is Span =>
	typeof entry[0] === "string";

/**
 * Band of the given width centred on a closed polyline, rounded where it
 * turns: a line as thick in WebGL, whose lines are one pixel wide.
 */
function band(points: readonly Vector2[], width: number): BufferGeometry {
	const n = points.length;
	const at = (i: number) => points[i % n] ?? new Vector2();
	const half = width / 2;
	const vertices: number[] = [];
	const triangle = (...corners: Vector2[]) => {
		for (const c of corners) vertices.push(c.x, c.y, 0);
	};
	for (let i = 0; i < n; i++) {
		const [a, b, c] = [at(i), at(i + 1), at(i + 2)];
		const along = b.clone().sub(a);
		const side = new Vector2(-along.y, along.x).setLength(half);
		triangle(a.clone().add(side), a.clone().sub(side), b.clone().sub(side));
		triangle(a.clone().add(side), b.clone().sub(side), b.clone().add(side));
		const next = c.clone().sub(b);
		if (Math.abs(Math.atan2(along.cross(next), along.dot(next))) < JOIN_TURN) {
			continue;
		}
		for (let k = 0; k < JOIN_STEPS; k++) {
			const turn = (angle: number) =>
				new Vector2(Math.cos(angle), Math.sin(angle))
					.multiplyScalar(half)
					.add(b);
			const step = (2 * Math.PI) / JOIN_STEPS;
			triangle(b, turn(k * step), turn((k + 1) * step));
		}
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
	return geometry;
}

/**
 * All layers lie in one plane, so that none slides over another when seen
 * from above. The suit, pushed back, alone writes depth: the rest is painted
 * over it in draw order.
 */
const paint = (color: Color, order: number) =>
	new MeshBasicMaterial({
		color: FIGURE[color],
		side: DoubleSide,
		...(order === 0
			? { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }
			: { depthWrite: false }),
	});

const layer = (points: Vector2[], color: Color, order: number) => {
	const mesh = new Mesh(
		new ShapeGeometry(new Shape(points)),
		paint(color, order),
	);
	mesh.renderOrder = order;
	return mesh;
};

export function buildHuman(edge: LineBasicMaterial): Group {
	const outline = sample(OUTLINE);
	const gaps = GAPS.map(sample);
	const curves = [outline, ...gaps];
	const top = AREAS.length + 2;
	const figure = new Group();
	figure.add(layer(outline.points, "suit", 0));
	for (const gap of gaps) {
		const board = layer(gap.points, "board", 1);
		const gapEdge = new LineSegments(new EdgesGeometry(board.geometry), edge);
		gapEdge.renderOrder = top;
		figure.add(board, gapEdge);
	}
	AREAS.forEach((area, k) => {
		const points =
			"shape" in area
				? sample(area.shape).points
				: area.path.flatMap((entry) =>
						isSpan(entry)
							? span(curves, entry)
							: [new Vector2(entry[0], entry[1])],
					);
		figure.add(layer(points, area.ink, k + 2));
	});
	for (const color of new Set(LINES.map(([color]) => color))) {
		const segments = LINES.filter(([c]) => c === color).flatMap(([, line]) =>
			line
				.slice(1)
				.flatMap((point, k) =>
					[line[k] ?? point, point].map(([x, y]) => new Vector3(x, y, 0)),
				),
		);
		const lines = new LineSegments(
			new BufferGeometry().setFromPoints(segments),
			new LineBasicMaterial({ color: FIGURE[color], depthWrite: false }),
		);
		lines.renderOrder = top;
		figure.add(lines);
	}
	const rim = new Mesh(band(outline.points, RIM / SCALE), paint("rim", top));
	rim.renderOrder = top;
	figure.add(rim);
	figure.scale.setScalar(SCALE);
	return figure;
}

/** `size`: outer size of the object along X, Y and Z */
export function standBeside(
	figure: Group,
	size: readonly [number, number, number],
): void {
	// Extent of the object along SIDE, from its centre
	const distance =
		(size[0] + size[2]) / (2 * Math.SQRT2) + CLEARANCE + HALF_WIDTH;
	figure.position
		.copy(SIDE)
		.multiplyScalar(distance)
		.setY(-HUMAN_HEIGHT / 2);
}

export function humanReach(figure: Group): number {
	const { x, y, z } = figure.position;
	return Math.hypot(
		Math.hypot(x, z) + HALF_WIDTH,
		Math.max(Math.abs(y), y + HUMAN_HEIGHT),
	);
}

export function faceTowards(figure: Group, eye: Vector3): void {
	figure.rotation.y = Math.atan2(
		eye.x - figure.position.x,
		eye.z - figure.position.z,
	);
}
