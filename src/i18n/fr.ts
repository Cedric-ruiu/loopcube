import type { Limit } from "../app/settings";
import type {
	IssueCode,
	ParamName,
	PatternKind,
	ProfileShape,
} from "../geometry";
import type { Unit } from "../units/units";
import type { MarkDisplay } from "../viewer/model";
import { frenchSpacing } from "./typography";

export const fr = frenchSpacing({
	langName: "Français",
	meta: {
		title:
			"LoopCube — Générateur de cube infini en métal, plan de débit gratuit",
		description:
			"Créez votre cube infini en tube carré ou rond : rendu 3D, plan de fabrication et fiche de débit imprimables. Outil gratuit pour chaudronniers et soudeurs.",
		imageAlt:
			"Rendu 3D d'un cube infini en tube carré, pièces colorées par type",
	},
	root: {
		tagline: "Générateur de cube infini en métal",
	},
	home: {
		anchor: "generateur",
		h1: "Générateur de cube infini en métal",
		lead: "Cube classique, cube encadré ou table basse : réglez-le sur votre profilé, vérifiez-le en 3D, imprimez son plan de débit.",
		plan: {
			title: "Un plan qui suffit à l'atelier",
			text: "Trois feuilles A4 dessinées selon l'ISO 128, en projection du 1er dièdre, cotées en millimètres ou en pouces au 1/16. Une barre témoin de 100 mm, sur chaque feuille, vérifie l'échelle à l'impression.",
			sheets: [
				{
					title: "Vue d'ensemble",
					text: "Vues de face, de dessus et de côté cotées, vue axonométrique avec le repère de chaque pièce.",
					alt: "Feuille 1 du plan : grande vue axonométrique repérée d'un cube infini de 300 mm en tube carré, trois vues cotées, détail en coupe du jeu entre deux barres, vue diagonale et enchaînement de la boucle",
				},
				{
					title: "Nomenclature",
					text: "Quantités, longueurs de débit et matière totale à prévoir.",
					alt: "Feuille 2 du plan : tableau de nomenclature, notes de fabrication et croquis coté des 12 barres en U, avec leur vue d'extrémité à l'échelle 1:1",
				},
				{
					title: "Fiche de débit",
					text: "Chaque type de pièce coté, avec ses onglets et leur orientation.",
					alt: "Feuille 3 du plan : croquis cotés des barres vrillées à droite et à gauche, avec leur vue d'extrémité à l'échelle 1:1",
				},
			],
		},
		line: {
			title: "Une ligne sans début ni fin",
			text: "Le cube infini, aussi appelé cube impossible, est une sculpture faite d'une seule ligne de tube qui se referme sur elle-même en dessinant les arêtes d'un cube. Vu dans l'axe de sa grande diagonale, il semble tracé d'un trait continu : six lobes triangulaires autour d'une étoile. Il se décline aussi en cube encadré, dont le dessus et le dessous sont des cadres pleine taille, et en pavé allongé pour une table basse.",
			figures: [
				{ value: "18", label: "tronçons droits" },
				{ value: "18", label: "angles à 90°" },
				{ value: "6", label: "arêtes doublées" },
				{ value: "6", label: "arêtes simples" },
			],
			note: "Aucune barre ne touche les autres ailleurs qu'à ses deux angles soudés.",
		},
		steps: {
			title: "Comment s'en servir",
			items: [
				{
					title: "Choisir la forme et le profilé",
					text: "Cube classique, cube encadré ou pavé pour une table basse ; puis le tube, carré ou rond, en section du commerce ou sur mesure, avec son épaisseur de paroi.",
				},
				{
					title: "Régler les dimensions",
					text: "L'arête et le jeu entre barres, plus la longueur d'un pavé. En tube rond : coudes à souder ou tube cintré, puis le rayon de jonction.",
				},
				{
					title: "Vérifier en 3D",
					text: "Faites-le tourner, puis passez en « Vue diagonale » pour voir l'illusion de la ligne infinie.",
				},
				{
					title: "Imprimer le plan",
					text: "Le bouton « Plan de fabrication (A4) » ouvre l'impression ; choisissez PDF pour l'enregistrer.",
				},
			],
		},
		trades: {
			title: "Chaudronnerie, tuyauterie, soudure",
			text: "Un bon exercice de précision : coupes d'onglet, jeux entre barres et alignement des soudures, tout se voit.",
			audience:
				"Pour les chaudronniers, tuyauteurs, métalliers et soudeurs, les apprentis et leurs formateurs, comme pour les amateurs équipés d'un poste à souder.",
			action: "Régler mon cube",
		},
	},
	langSwitch: {
		label: "Langue",
	},
	nav: {
		skip: "Aller au générateur",
		home: "LoopCube, accueil",
	},
	footer: {
		tagline:
			"Générateur de cube infini en tube carré ou rond, avec plan de fabrication imprimable. Gratuit et sans compte : tout se calcule dans votre navigateur, vos cotes n’en sortent pas.",
		contactTitle: "Un mot ?",
		contactText:
			"Une cote qui ne tombe pas juste, un tube qui manque dans la liste, ou un cube soudé avec ce plan ? Écrivez-moi, une photo me fera toujours plaisir.",
		contactCta: "Écrire un email",
		contactSubject: "LoopCube — question ou retour",
		copyEmail: "Copier",
		copySuccess: "Adresse copiée",
		share: "Partager LoopCube",
		shareCopied: "Lien copié",
		contributeTitle: "Contribuer",
		openSource:
			"Projet open source sous licence MIT. Corrections et idées bienvenues.",
		issues: "Signaler un bug ou proposer une idée",
		credit:
			"Créé par {name}, chaudronnier en formation et développeur web freelance ({site}).",
		privacy:
			"Mesure d’audience anonyme et sans cookie (Umami) : pages vues et usage de l’outil, jamais vos cotes.",
	},
	notFound: {
		title: "Page introuvable",
		text: "Cette adresse ne mène à aucune page de LoopCube.",
		link: "Aller au générateur de cube infini",
	},
	params: {
		edge: "Arête du cube",
		length: "Longueur",
		depth: "Profondeur",
		width: "Largeur du profilé",
		gap: "Jeu entre barres",
		wall: "Épaisseur de paroi",
		bendRadius: "Rayon de jonction",
	} satisfies Record<ParamName, string>,
	issues: {
		notPositive: "{param} doit être supérieur à zéro.",
		wallTooThick:
			"L'épaisseur de paroi ne peut pas dépasser la moitié de la largeur ({limit}).",
		bendRadiusTooSmall:
			"Le rayon de jonction doit être d'au moins un diamètre ({limit}).",
		straightTooShort:
			"Trop petit pour ce profilé : une partie droite deviendrait trop courte. {param} : {limit} minimum.",
		lengthTooShort:
			"La longueur doit être au moins égale à la profondeur ({limit}).",
	} satisfies Record<IssueCode, string>,
	limits: {
		straight:
			"Limite atteinte : la plus courte partie droite ne mesure plus que {min}.",
		solid:
			"Limite atteinte : l'épaisseur vaut la moitié de la largeur, c'est une barre pleine.",
		radius: "Limite atteinte : le rayon ne descend pas sous un diamètre.",
		length: "Limite atteinte : la longueur égale la profondeur.",
	} satisfies Record<Limit, string>,
	ui: {
		settings: "Réglages",
		unit: "Unité",
		units: { mm: "mm", in: "pouces" } satisfies Record<Unit, string>,
		pattern: "Forme",
		patterns: {
			cube: "Cube classique",
			framed: "Cube encadré",
			box: "Pavé (table basse)",
		} satisfies Record<PatternKind, string>,
		patternHints: {
			cube: "Le cube infini d'origine : six faces identiques.",
			framed:
				"Dessus et dessous en cadres pleine taille, au ras des arêtes : de quoi y poser un plateau.",
			box: "Le cube encadré, allongé : réglez sa longueur, sa profondeur et sa hauteur, pour une table basse par exemple.",
		} satisfies Record<PatternKind, string>,
		edge: {
			cube: "Arête du cube",
			framed: "Arête du cube",
			box: "Hauteur",
		} satisfies Record<PatternKind, string>,
		profile: "Profilé",
		shapes: { square: "Tube carré", round: "Tube rond" } satisfies Record<
			ProfileShape,
			string
		>,
		joint: "Jonctions",
		joints: { elbow: "Coudes à souder", bent: "Tube cintré" },
		section: "Section standard",
		custom: "Sur mesure",
		width: {
			square: "Largeur du profilé",
			round: "Diamètre extérieur",
		} satisfies Record<ProfileShape, string>,
		gapAuto: {
			square: "Auto (½ largeur)",
			round: "Auto (½ Ø)",
		} satisfies Record<ProfileShape, string>,
		radiusAuto: "Auto (1,5 × Ø)",
		blocked: "{option} indisponible. {reason}",
		sizesBlocked: "Les sections grisées ne tiennent pas dans ce cube.",
		notANumber: "Valeur non reconnue. Exemple : {example}.",
		range: "Valeurs possibles avec ces réglages : de {min} à {max}.",
		rangeFrom: "Valeur minimale avec ces réglages : {min}.",
	},
	viewer: {
		label: "Rendu 3D du cube infini",
		loading: "Chargement de la 3D…",
		unavailable:
			"Rendu 3D indisponible : ce navigateur ne prend pas en charge WebGL.",
		diagonal: "Vue diagonale",
		colors: "Couleurs par type",
		human: "Silhouette 1,82 m",
		dimensions: "Cotes",
		marks: "Repères",
		markDisplays: {
			none: "aucun",
			type: "par type",
			piece: "par pièce",
		} satisfies Record<MarkDisplay, string>,
		help: "Glisser pour tourner, molette ou pincement pour zoomer",
		legend: "Pièces à débiter",
	},
	parts: {
		bar: {
			"same-side": "Barre, onglets du même côté (en U)",
			opposite: "Barre, onglets opposés",
			right: "Barre, onglets à 90°, vrillée à droite",
			left: "Barre, onglets à 90°, vrillée à gauche",
		},
		tube: "Tube droit",
		elbow: "Coude à 90°",
		section: "Section cintrée, {bends} cintres",
		axis: "{length} à l'axe",
		radius: "R {radius}",
		developed: "{length} développé",
	},
	plan: {
		button: "Plan de fabrication (A4)",
		loading: "Préparation du plan…",
		/** Drawing conventions of the language: ISO 128, first angle */
		standard: "iso" as "iso" | "asme",
		file: "LoopCube - plan de fabrication",
		title: {
			cube: "LoopCube — Cube infini",
			framed: "LoopCube — Cube infini encadré",
			box: "LoopCube — Pavé infini",
		} satisfies Record<PatternKind, string>,
		subtitle: "Plan de fabrication",
		sheets: {
			overview: "Vue d'ensemble",
			bom: "Nomenclature",
			cutting: "Fiche de débit",
		},
		block: {
			params: "Paramètres",
			date: "Date",
			unit: "Unité",
			scale: "Échelle",
			tolerance: "Tolérance générale",
			projection: "Projection",
			standard: "Norme",
			page: "Page",
		},
		units: { mm: "mm", in: "pouce (in)" },
		unitNote: {
			mm: "Cotes en millimètres.",
			in: 'Cotes en pouces, au 1/16".',
		},
		standardName: "ISO 128",
		projectionName: "1er dièdre",
		tolerance: { mm: "ISO 13920-BF", in: "ISO 13920-BF" },
		asNoted: "indiquée",
		notToScale: "sans échelle",
		unrolledScale: "sans échelle",
		printAt: "Imprimer à 100 %",
		checkBar: "cette barre doit mesurer {length}",
		credit: "Généré avec LoopCube, de Cédric Ruiu",
		scaleLabel: "Éch. {scale}",
		views: {
			front: "Vue de face",
			top: "Vue de dessus",
			left: "Vue de gauche",
			right: "Vue de droite",
			axo: "Vue axonométrique, repères des pièces",
			diagonal: "Vue diagonale",
		},
		weld: {
			square: "{count} angles",
			elbow: "{count} jonctions",
			bent: "{count} raboutages",
		},
		sequence: {
			title: "Enchaînement de la boucle",
			pattern: "Motif répété :",
			note: "Ordre des pièces le long de la boucle fermée : ce n'est pas un ordre d'assemblage.",
		},
		auxiliary:
			"Cotes entre parenthèses : cotes auxiliaires, données pour information.",
		detail: "Détail X, coupe (éch. {scale})",
		elbows: "{mark} : {count} coudes identiques, un à chaque angle.",
		paramsLine: "{size} · {section} · G = {gap}",
		size: "A = {edge}",
		boxSize: "A = {edge} · B = {length} · C = {depth}",
		radiusParam: "R = {radius}",
		bom: {
			mark: "Rep.",
			qty: "Qté",
			designation: "Désignation",
			stock: "Profilé",
			pieces: "Pièces",
			cut: "Long. de débit",
			total: "Long. totale",
			bought: "du commerce",
			material: "Matière totale",
			materialNote:
				"Longueur cumulée de profilé, chutes de coupe et traits de scie non compris : prévoir une marge.",
		},
		notes: {
			title: "Notes",
			size: {
				cube: "A : arête du cube (encombrement)",
				box: "A : hauteur hors tout · B : longueur hors tout · C : profondeur hors tout",
			},
			symbols:
				"{size} · W : largeur ou Ø du profilé · G : jeu entre deux barres parallèles voisines, mesuré perpendiculairement à une face du cube · L : longueur à l'axe, d'angle à angle.",
			radius: "R : rayon de cintrage ou de coude, à l'axe du tube.",
			square:
				"18 barres coupées d'onglet à 45° aux deux bouts, soudées bout à bout aux 18 angles.",
			elbow:
				"18 tubes coupés d'équerre et 18 coudes à 90°, soudés bout à bout.",
			bent: "{count} sections cintrées planes, raboutées par {count} soudures bout à bout au milieu des tronçons des arêtes simples.",
			closure:
				"Équerrage des angles critique : les écarts des {count} soudures se cumulent à la fermeture de la boucle.",
			closureBent:
				"Équerrage des cintres critique : les écarts des {bends} cintres et des {count} soudures se cumulent à la fermeture de la boucle.",
			flush:
				"Soudures meulées à ras pour l'effet de ligne continue (facultatif).",
			marks:
				"Les repères (A1, A2…) sont ceux de la vue axonométrique et du rendu 3D.",
		},
		card: {
			heading: "Repère {id} · {qty} pièces · {designation}",
			piece: "Pièces",
			stock: "Profilé",
			end: "Extr. {n}",
		},
		bar: {
			axis: "Longueur à l'axe (L)",
			outside: "Pointe à pointe (L + W)",
			inside: "Côté intérieur (L − W)",
			mitres: "Onglets",
			mitreValue: "45° aux deux extrémités",
			orientation: "Orientation des onglets",
			orientations: {
				"same-side": "du même côté (0°)",
				opposite: "opposés (180°)",
				right: "tournés de 90°, sens horaire",
				left: "tournés de 90°, sens anti-horaire",
			},
			endView: "Vue depuis l'extr. 1",
			endViewNote:
				"Flèches : côté court (intérieur de l'angle) de l'onglet de chaque extrémité.",
			views: { front: "Face", top: "Dessus" },
		},
		tube: {
			cut: "Longueur de coupe (L − 2R)",
			ends: "Coupe d'équerre aux deux bouts",
			endView: "Vue de bout",
		},
		elbow: {
			radius: "Rayon à l'axe (R)",
			diameter: "Ø extérieur",
			angle: "Angle",
			kind: "Coude à souder bout à bout, du commerce",
		},
		section: {
			developed: "Longueur développée (à l'axe)",
			radius: "Rayon de cintrage (R)",
			shape: "Forme de la section (plane), cotes à l'axe",
			unrolled: "Développé, cotes depuis l'extrémité 1",
			bends: "Cintres",
			bend: "Cintre",
			start: "Début",
			finish: "Fin",
			angle: "Angle",
			twist: "Rotation",
			first: "—",
			welds: "Raboutage des sections",
			weld: "{from} → {to}",
			twistNote:
				"Rotation du tube depuis le cintre précédent ; positive en sens horaire, en regardant le long du tube de l'extr. 1 vers l'extr. 2.",
			grip: "Prévoir une surlongueur de serrage pour le cintrage, à recouper.",
		},
	},
});

export type Messages = typeof fr;
