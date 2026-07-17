# Routes API — SHALOM Backend

Ce document recense l'intégralité des routes REST implémentées et actives à ce jour dans l'application.
*Toutes les routes (à l'exception de la route de santé, des routes d'authentification et de la soumission publique d'un formulaire CAMAJ) requièrent un token JWT via le header `Authorization: Bearer <token>`.*

---

## 🟢 Route globale de santé

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Vérifier l'état du serveur |

---

## 🔐 1. Authentification (`/api/v1/auth`)

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Inscription d'un nouvel utilisateur |
| `POST` | `/api/v1/auth/login` | Connexion utilisateur (génère access + refresh tokens) |
| `POST` | `/api/v1/auth/refresh` | Rafraîchir un token d'accès expiré via un refresh token |

---

## 👤 2. Profils (`/api/v1/profiles`)

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/profiles/me` | Récupérer le profil de l'utilisateur connecté |
| `PATCH` | `/api/v1/profiles/me` | Mettre à jour le profil de l'utilisateur connecté |
| `GET` | `/api/v1/profiles/search` | Rechercher des utilisateurs par nom d'affichage (`?q=`, `?page=`, `?limit=`) |
| `GET` | `/api/v1/profiles/:userId` | Récupérer le profil public d'un autre utilisateur (sans champs sensibles) |

---

## 📝 3. Publications / Posts (`/api/v1/posts`)

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/posts/` | Récupérer le fil d'actualité (feed) avec pagination |
| `POST` | `/api/v1/posts/` | Créer une nouvelle publication |
| `GET` | `/api/v1/posts/:id` | Récupérer les détails d'une publication spécifique |
| `PATCH` | `/api/v1/posts/:id` | Mettre à jour une publication (contenu) |
| `DELETE`| `/api/v1/posts/:id` | Supprimer une publication (soft delete) |

---

## 💬 4. Commentaires (`/api/v1/comments`)

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/comments/post/:postId`| Lister les commentaires d'une publication avec pagination |
| `POST` | `/api/v1/comments/post/:postId`| Ajouter un nouveau commentaire sous une publication |
| `DELETE`| `/api/v1/comments/:id` | Supprimer un commentaire (soft delete) |

---

## ❤️ 5. Likes (`/api/v1/likes`)

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/likes/` | Ajouter un like à un contenu (post ou commentaire) |
| `DELETE`| `/api/v1/likes/` | Retirer son like d'un contenu |

---

## 👥 6. Abonnements / Follows (`/api/v1/follows`)

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/follows/` | Suivre un autre utilisateur |
| `DELETE`| `/api/v1/follows/:followedId` | Se désabonner d'un utilisateur |
| `GET` | `/api/v1/follows/user/:userId/followers` | Lister les abonnés d'un utilisateur donné |
| `GET` | `/api/v1/follows/user/:userId/following` | Lister les abonnements d'un utilisateur donné |
| `GET` | `/api/v1/follows/user/:userId/follow-status`| Vérifier le statut de suivi entre le requester et l'utilisateur |

---

## 🌍 7. Groupes (`/api/v1/groups`)

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/groups/` | Lister et rechercher des groupes avec pagination |
| `POST` | `/api/v1/groups/` | Créer un nouveau groupe |
| `GET` | `/api/v1/groups/:id` | Obtenir les détails complets d'un groupe |
| `PATCH` | `/api/v1/groups/:id` | Mettre à jour un groupe (réservé aux admins du groupe) |
| `DELETE`| `/api/v1/groups/:id` | Supprimer un groupe (réservé au propriétaire) |
| `POST` | `/api/v1/groups/:id/members` | Demander à rejoindre un groupe / Rejoindre |
| `GET` | `/api/v1/groups/:id/members` | Lister les membres d'un groupe |
| `DELETE`| `/api/v1/groups/:id/members/:userId` | Retirer un membre ou quitter le groupe soi-même |
| `PATCH` | `/api/v1/groups/:id/members/:userId/role` | Mettre à jour le rôle d'un membre (ex: passer admin) |
| `PATCH` | `/api/v1/groups/:id/members/:userId/status`| Mettre à jour le statut d'un membre (ex: approuver adhésion) |

---

## ✉️ 8. Messagerie / Conversations (`/api/v1/conversations`)

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/conversations/` | Lister les conversations de l'utilisateur (Inbox) |
| `POST` | `/api/v1/conversations/` | Initier une nouvelle conversation avec un utilisateur |
| `GET` | `/api/v1/conversations/:id/messages` | Lister les messages d'une conversation spécifique |
| `POST` | `/api/v1/conversations/:id/messages` | Envoyer un message dans la conversation |
| `PATCH` | `/api/v1/conversations/:id/read` | Marquer tous les messages d'une conversation comme lus |

---

## 🔔 9. Notifications (`/api/v1/notifications`)

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/notifications/` | Lister les notifications de l'utilisateur avec pagination |
| `GET` | `/api/v1/notifications/unread-count` | Obtenir le compteur de notifications non lues |
| `PATCH` | `/api/v1/notifications/read-all` | Marquer toutes ses notifications comme lues |
| `PATCH` | `/api/v1/notifications/:id/read` | Marquer une notification spécifique comme lue |

---

## 🚨 10. Signalements / Reports (`/api/v1/reports`)

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/reports/` | Signaler un contenu inapproprié (post ou commentaire) |
| `GET` | `/api/v1/reports/` | Lister les signalements *(Réservé aux Administrateurs)* |
| `PATCH` | `/api/v1/reports/:id` | Traiter et mettre à jour le statut d'un signalement *(Admin)* |

---

## 📎 11. Téléversements (`/api/v1/uploads`)

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/uploads/` | Téléverser une image ou une vidéo (multipart, champ `file`, max 50 Mo) |

Le type est déterminé à partir des **octets du fichier**, jamais du nom ni du
`Content-Type` annoncés : ceux-ci viennent du client et ne prouvent rien.
L'extension stockée découle du type détecté. Types acceptés : PNG, JPEG, GIF,
WEBP, MP4, MOV, WEBM. Tout le reste est refusé — SVG compris, car il peut
exécuter du script. Les fichiers sont servis sur `/uploads/<nom>`.

---

## 🎓 12. CAMAJ — Demandes des formulaires publics (`/api/v1/camaj`)

Table unifiée des demandes issues des formulaires publics du CAMAJ (mentorat,
programmes, projets FAJ, dons, relation d'aide). Champs communs en colonnes,
reste du formulaire conservé tel quel en JSONB (`payload`).

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/camaj/submissions` | Soumettre une demande depuis un formulaire CAMAJ **(public, sans token)** |
| `GET` | `/api/v1/camaj/submissions` | Lister les demandes avec pagination et filtres `?type=` / `?status=` *(Admin)* |
| `GET` | `/api/v1/camaj/submissions/stats` | Compteurs par statut et par type pour le tableau de bord *(Admin)* |
| `PATCH` | `/api/v1/camaj/submissions/:id` | Changer le statut d'une demande *(Admin)* |

La création attend un corps `{ type, data }` où `type` ∈ `mentor`, `programme`,
`mentorat`, `faj`, `don`, `relation_aide`, et `data` est l'état complet du
formulaire (un `nom` — ou `prenom` — et un moyen de contact `whatsapp` ou `email`
sont requis). Le statut d'une demande ∈ `nouveau`, `traite`, `archive`.
La soumission publique est limitée à **20 requêtes / 15 min par IP**.
L'accès administrateur est déterminé par la variable d'environnement `ADMIN_EMAILS`.

---

## 💰 13. Gestion Financière (`/api/v1/finance`)

Outil de finances personnelles. Toutes les routes sont **authentifiées** et
cloisonnées à l'utilisateur connecté (chacun ne voit que ses propres données).

### Catégories

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/finance/categories` | Lister ses catégories (filtre optionnel `?type=income\|expense`) |
| `POST` | `/api/v1/finance/categories` | Créer une catégorie (`{ name, type, icon? }`) |
| `PATCH` | `/api/v1/finance/categories/:id` | Mettre à jour une catégorie (`{ name?, icon? }`) |
| `DELETE`| `/api/v1/finance/categories/:id` | Supprimer une catégorie (soft delete) |

### Transactions

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/finance/transactions` | Lister ses transactions — filtres `?type=` `?category_id=` `?from=` `?to=`, paginé |
| `POST` | `/api/v1/finance/transactions` | Enregistrer une transaction (`{ type, amount, transaction_date, category_id?, note?, is_recurring?, recurrence_frequency? }`) |
| `GET` | `/api/v1/finance/transactions/:id` | Détail d'une transaction |
| `PATCH` | `/api/v1/finance/transactions/:id` | Mettre à jour une transaction |
| `DELETE`| `/api/v1/finance/transactions/:id` | Supprimer une transaction (soft delete) |

### Objectifs d'épargne

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/finance/goals` | Lister ses objectifs (filtre optionnel `?status=`) |
| `POST` | `/api/v1/finance/goals` | Créer un objectif (`{ title, target_amount, current_amount?, target_date? }`) |
| `GET` | `/api/v1/finance/goals/:id` | Détail d'un objectif |
| `PATCH` | `/api/v1/finance/goals/:id` | Mettre à jour un objectif (`{ title?, target_amount?, current_amount?, target_date?, status? }`) |
| `DELETE`| `/api/v1/finance/goals/:id` | Supprimer un objectif (soft delete) |

### Analyse

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/finance/summary` | Résumé d'un mois (`?year_month=YYYY-MM`, mois courant par défaut) : revenus, dépenses, taux d'épargne, répartition par catégorie. Mis en cache dans `finance_monthly_summary`. |
| `GET` | `/api/v1/finance/overview` | Aperçu global : total revenus, total dépenses, solde, nombre d'objectifs actifs |

Types de transaction : `income`, `expense`. Fréquences de récurrence : `daily`,
`weekly`, `monthly`, `yearly`. Statuts d'objectif : `active`, `achieved`,
`abandoned`. Les montants sont des `NUMERIC(12,2)` strictement positifs.

---

## 🙏 14. Outils Spirituels (`/api/v1/spiritual`)

Lecture biblique, carnet de prière, versets du jour, journal spirituel et
louange. Toutes les routes sont **authentifiées** ; les données personnelles
(prières, journal, progression, playlists) sont cloisonnées à leur propriétaire.

### Plans de lecture biblique

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/spiritual/plans` | Catalogue : plans publics + les siens, avec sa progression |
| `POST` | `/api/v1/spiritual/plans` | Créer un plan (`{ title, total_days, description?, duration_type?, is_public? }`) |
| `GET` | `/api/v1/spiritual/plans/:id` | Détail d'un plan **avec ses jours** |
| `POST` | `/api/v1/spiritual/plans/:id/days` | Définir le contenu d'un jour *(créateur du plan)* |
| `POST` | `/api/v1/spiritual/plans/:id/start` | Démarrer le plan (idempotent) |
| `POST` | `/api/v1/spiritual/plans/:id/complete-day` | Valider un jour → met à jour progression et **streak** |
| `GET` | `/api/v1/spiritual/plans/:id/logs` | Jours validés (calendrier) |
| `PATCH` | `/api/v1/spiritual/plans/:id/progress` | Changer le statut (`active`/`completed`/`abandoned`) |
| `GET` | `/api/v1/spiritual/progress` | Progression sur tous ses plans |

**Streak** : +1 si la validation précédente date de la veille, inchangé si elle
date du jour même, remis à 1 après une interruption. Valider le dernier jour
passe le plan à `completed`. Rejouer un jour déjà validé est sans effet
(`already_completed: true`).

### Carnet de prière

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/spiritual/prayers` | Lister ses sujets (filtres `?status=` `?category=`, paginé) |
| `POST` | `/api/v1/spiritual/prayers` | Ajouter (`{ title, description?, category?, reminder_frequency? }`) |
| `GET` | `/api/v1/spiritual/prayers/:id` | Détail |
| `PATCH` | `/api/v1/spiritual/prayers/:id` | Mettre à jour — passer à `answered` **horodate** `answered_at`, en sortir l'efface |
| `DELETE`| `/api/v1/spiritual/prayers/:id` | Supprimer (soft delete) |

Statuts : `pending`, `answered`, `ongoing`. Rappels : `daily`, `weekly`, `none`.

### Versets / citations

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/spiritual/verses/today` | Verset du jour (celui daté d'aujourd'hui, sinon rotation déterministe) — enregistre la consultation |
| `GET` | `/api/v1/spiritual/verses/favorites` | Ses versets favoris |
| `POST` | `/api/v1/spiritual/verses` | Ajouter au catalogue *(Admin)* |
| `PATCH` | `/api/v1/spiritual/verses/:id/favorite` | Marquer/retirer des favoris (`{ is_favorite }`) |

### Journal spirituel

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/spiritual/journal` | Lister ses entrées (filtres `?entry_type=` `?from=` `?to=`, paginé) |
| `POST` | `/api/v1/spiritual/journal` | Ajouter (`{ content, entry_type?, mood?, entry_date? }`) |
| `GET` | `/api/v1/spiritual/journal/:id` | Détail |
| `PATCH` | `/api/v1/spiritual/journal/:id` | Mettre à jour |
| `DELETE`| `/api/v1/spiritual/journal/:id` | Supprimer (soft delete) |

Types d'entrée : `note`, `gratitude`.

### Louange

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/spiritual/songs` | Chants publics + les siens (recherche `?q=`, `?category=`, paginé) |
| `POST` | `/api/v1/spiritual/songs` | Ajouter un chant |
| `GET` | `/api/v1/spiritual/songs/:id` | Détail d'un chant |
| `GET` | `/api/v1/spiritual/playlists` | Ses playlists (avec `songs_count`) |
| `POST` | `/api/v1/spiritual/playlists` | Créer une playlist |
| `GET` | `/api/v1/spiritual/playlists/:id` | Détail **avec ses chants ordonnés** |
| `PATCH` | `/api/v1/spiritual/playlists/:id` | Mettre à jour |
| `DELETE`| `/api/v1/spiritual/playlists/:id` | Supprimer (soft delete) |
| `POST` | `/api/v1/spiritual/playlists/:id/songs` | Ajouter un chant (`position` auto si non fournie) |
| `DELETE`| `/api/v1/spiritual/playlists/:id/songs/:songId` | Retirer un chant |

> ⚠️ **Note de maintenance** : `bible_reading_plans.created_by` et
> `worship_songs.created_by` sont en `NO ACTION` (pas de `ON DELETE CASCADE`).
> Supprimer un compte ayant créé un plan ou un chant échoue tant que ces lignes
> existent — les nettoyer d'abord (cf. `tests/spiritual.test.js`).

---

## 🧰 15. Outils pratiques du quotidien (`/api/v1/tools`)

Dîme/offrandes, événements personnels, listes de tâches et convertisseur
d'unités. Toutes les routes sont **authentifiées** ; les données sont
cloisonnées à leur propriétaire (le référentiel d'unités est commun à tous).

### Calculatrice de dîme / offrandes

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/tools/tithe` | Historique (filtres `?is_paid=` `?from=` `?to=`, paginé) |
| `POST` | `/api/v1/tools/tithe` | Calculer et enregistrer (`{ income_amount, tithe_percentage?, offering_amount?, calculation_date? }`) |
| `GET` | `/api/v1/tools/tithe/:id` | Détail d'un calcul |
| `PATCH` | `/api/v1/tools/tithe/:id` | Marquer payé / ajuster l'offrande (`{ is_paid?, offering_amount? }`) |
| `DELETE`| `/api/v1/tools/tithe/:id` | Supprimer (définitif — la table n'a pas de `deleted_at`) |

Le `tithe_amount` est **toujours calculé côté serveur** (`ROUND(revenu × % / 100, 2)`),
jamais repris du client. Pourcentage par défaut : **10 %**. Marquer payé horodate
`paid_at` ; repasser à non payé l'efface.

### Événements personnels

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/tools/personal-events` | Lister (filtres `?status=` `?event_type=` `?from=` `?to=`, paginé) |
| `POST` | `/api/v1/tools/personal-events` | Planifier (`{ title, start_date, event_type?, description?, end_date?, reminder_enabled?, reminder_before_minutes? }`) |
| `GET` | `/api/v1/tools/personal-events/:id` | Détail |
| `PATCH` | `/api/v1/tools/personal-events/:id` | Mettre à jour (dont `status`) |
| `DELETE`| `/api/v1/tools/personal-events/:id` | Supprimer (soft delete) |

Types : `jeune`, `retraite`, `priere`, `autre`. Statuts : `planned`, `completed`, `cancelled`.

### Listes de tâches

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/tools/task-lists` | Ses listes, avec `tasks_count` et `completed_count` |
| `POST` | `/api/v1/tools/task-lists` | Créer une liste (`{ title? }`, défaut « Ma liste ») |
| `GET` | `/api/v1/tools/task-lists/:id` | Détail **avec ses tâches triées par position** |
| `PATCH` | `/api/v1/tools/task-lists/:id` | Renommer |
| `DELETE`| `/api/v1/tools/task-lists/:id` | Supprimer (soft delete) |
| `PATCH` | `/api/v1/tools/task-lists/:id/reorder` | **Réordonner** (`{ ordered_ids: [uuid, …] }`) → positions `1..n` |

Le réordonnancement est **transactionnel** et rejette (404) tout `ordered_ids`
contenant une tâche qui n'appartient pas à la liste.

### Tâches

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/tools/tasks` | Lister ses tâches (filtres `?list_id=` `?is_completed=` `?due_before=`, paginé) |
| `POST` | `/api/v1/tools/tasks` | Ajouter (`{ list_id, content, due_date?, position? }`) — position auto en fin de liste |
| `GET` | `/api/v1/tools/tasks/:id` | Détail |
| `PATCH` | `/api/v1/tools/tasks/:id` | Mettre à jour (`{ content?, is_completed?, due_date?, position? }`) |
| `DELETE`| `/api/v1/tools/tasks/:id` | Supprimer (soft delete) |

Cocher une tâche horodate `completed_at` ; la décocher l'efface.

### Convertisseur d'unités

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/tools/units` | Référentiel groupé par catégorie (4 catégories, 18 unités) |
| `POST` | `/api/v1/tools/units/convert` | Convertir (`{ from_unit_id, to_unit_id, value }`) |
| `GET` | `/api/v1/tools/units/history` | Ses 20 dernières paires converties (avec `used_count`) |

La conversion passe par l'unité de base de la catégorie :
`résultat = valeur × facteur_source ÷ facteur_cible`. Deux unités de
**catégories différentes** renvoient **400 `CATEGORY_MISMATCH`**.
Unités de base : `m` (Longueur), `kg` (Poids), `L` (Volume), `XOF` (Devise).

> 💱 **Devises** : seul l'euro est seedé face au franc CFA, car cette parité est
> **fixe** (1 EUR = 655,957 XOF). Les devises à taux flottant (USD, GBP…) ne
> sont volontairement pas incluses : un taux figé en base induirait l'utilisateur
> en erreur. Les ajouter suppose de brancher une source de taux à jour.
