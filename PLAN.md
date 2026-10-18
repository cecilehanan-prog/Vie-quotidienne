# Mon Quotidien : plan de l'appli

Une appli web installable sur le téléphone (PWA : on l'ajoute à l'écran d'accueil depuis le navigateur, pas besoin de store). Gratuite, sans pub, tes données restent sur ton téléphone.

## Ce qui marche déjà dans le prototype

| Rubrique | Contenu | Source | Compte nécessaire |
|---|---|---|---|
| Aujourd'hui | Météo, prochains rendez-vous, rappels urgents, bonne nouvelle du jour | tout ce qui suit | non |
| Météo | Tarare, Lyon, Paris : maintenant, heure par heure, 5 jours ; qualité de l'air et pollens ; lien vigilance Rhône | Open-Meteo (gratuit, sans clé) | non |
| Infos | Monde, France, Lyon, Tarare et alentours (Ouest rhodanien, Amplepuis, Beaujolais), Bonnes nouvelles | flux RSS : France 24, franceinfo, Lyon Capitale, Google Actualités, Positivr | non |
| Agenda | Rendez-vous, rappels (1 h avant, la veille, 2 jours avant), import d'un export Google Agenda (.ics) | stocké sur le téléphone | non |
| Voiture | Itinéraire en un geste vers Waze, Google Maps ou Plans ; trafic Bison Futé et Onlymoov ; prix des carburants à Tarare | prix-carburants (data.gouv) | non |
| Transports | Réseau TCL ou RATP affiché automatiquement quand tu es près de Lyon ou Paris ; perturbations, itinéraires, tarifs ; TER Tarare–Lyon | localisation du téléphone + sites officiels | non |
| Voyage | Météo à destination sur 7 jours, liens prêts pour trains (SNCF Connect, Trainline), avions (Google Vols), BlaBlaCar, hôtels, conseils aux voyageurs ; liste de valise | Open-Meteo + liens | non |
| Démarches | Rappels impôts (déclaration, zone 3 pour le Rhône, taxe foncière), CAF trimestrielle, espace famille de Tarare, contrôle technique ; accès rapides impots.gouv, CAF, ville de Tarare, Ameli, ANTS | dates indicatives modifiables | non |
| Maison : courses | Liste de courses rangée par rayon, « J'ai fini mes courses » garde l'historique ; produits habituels (brioche, Nutella, café viennois, salade, fromages) avec alerte « à racheter » et budget du mois | stocké sur le téléphone | non |
| Maison : énergie | Relevés des compteurs électricité et eau, conso par jour et par mois, coût estimé, évolution ; liens Enedis (Linky) et eaufrance | stocké sur le téléphone | non |
| Maison : tâches | Tâches qui reviennent (poubelles, draps, plantes, cafetière…) avec retard affiché | stocké sur le téléphone | non |
| Papiers | Liste des papiers avec dates d'expiration et alerte 3 mois avant | stocké sur le téléphone | non |

## Ce qui demande ton accord ou un compte

1. **Google Agenda en direct.** Il faut créer une petite autorisation Google (gratuit, 15 min) puis tu te connectes une fois. En attendant : export .ics depuis Google, importé dans l'appli.
2. **Vraies notifications, appli fermée.** Les rappels marchent quand l'appli est ouverte ou installée. Pour être prévenue même téléphone verrouillé, il faut un petit serveur d'envoi (gratuit sur Cloudflare ou Netlify). Alternative simple : garder les rappels dans Google Agenda, qui notifie déjà.
3. **Mettre l'appli en ligne** pour l'installer sur ton téléphone : un hébergement gratuit (GitHub Pages ou Netlify). Il me faut ton feu vert pour créer le dépôt.
4. **Coffre à papiers.** Je ne recommande pas de stocker les scans dans une appli maison. Mieux : un coffre-fort numérique sérieux et chiffré (Digiposte est gratuit, lié à La Poste) ou un dossier chiffré ; l'appli garde les dates et te prévient.

## Ce qui n'est pas réaliste à refaire

Un GPS type Waze avec trafic en temps réel demande des millions d'utilisateurs qui remontent des données. L'appli t'envoie directement dans Waze avec la destination déjà remplie, c'est le meilleur des deux.

## Idées pour la suite

- Conso électricité automatique depuis ton compteur Linky (compte Enedis, avec ton accord)
- Partager la liste de courses avec quelqu'un de la maison
- Menus de la semaine qui remplissent la liste de courses tout seuls

- Pharmacie de garde (3237), numéros utiles, collecte des déchets à Tarare
- Alerte départ : "pars maintenant pour ton rendez-vous" selon le trafic
- Suivi budget simple (factures, échéances, abonnements à résilier)
- Résumé du matin : météo + rendez-vous + une bonne nouvelle, en une notification
- Vigilance météo et alertes pollution en notification

## Fichiers

- `index.html` : l'appli complète (s'ouvre dans un navigateur)
- `app-body.html` : la source ; `sh build.sh` régénère `index.html`
- `manifest.webmanifest`, `sw.js`, `icon.svg` : installation sur le téléphone et mode hors ligne
