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
| `GET` | `/api/v1/groups/directory` | **Annuaire** des groupes / cellules (filtres `?category=` `?search=`, paginé) |
| `GET` | `/api/v1/groups/mine` | Ses groupes (membre actif), **avec son rôle** (`my_role`, `my_status`) |

`GET /groups/` ne liste que les groupes **publics** et ne dit rien de l'adhésion :
`GET /groups/mine` complète le module pour les écrans qui doivent proposer
« un de mes groupes » (créer un événement, partager une demande de prière,
publier une annonce — cette dernière filtrant sur `my_role` ∈ admin/modérateur).

L'annuaire (ajouté par la migration 007) s'appuie sur les colonnes
`group_category`, `meeting_schedule`, `location_info` et `is_directory_visible`
de `groups` — modifiables via `PATCH /api/v1/groups/:id` (admin du groupe).
Catégories : `cellule_priere`, `etude_biblique`, `jeunesse`, `autre`.

> 🔒 `is_directory_visible` vaut `true` par défaut. L'annuaire **exclut malgré
> tout les groupes `prive`** : ce défaut ne doit pas contourner le modèle de
> visibilité déjà en place.

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
| `GET` | `/api/v1/uploads/usage` | Quota de stockage de l'utilisateur connecté (`used_bytes`, `quota_bytes`, `remaining_bytes`) |

Le type est déterminé à partir des **octets du fichier**, jamais du nom ni du
`Content-Type` annoncés : ceux-ci viennent du client et ne prouvent rien.
L'extension stockée découle du type détecté. Types acceptés : PNG, JPEG, GIF,
WEBP, MP4, MOV, WEBM. Tout le reste est refusé — SVG compris, car il peut
exécuter du script. Les fichiers sont servis sur `/uploads/<nom>`.

Chaque compte dispose d'un quota de stockage cumulé (`UPLOAD_QUOTA_MB`,
défaut 500 Mo) : au-delà, `POST /api/v1/uploads` renvoie `413
UPLOAD_QUOTA_EXCEEDED`.

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

---

## 🤝 16. Outils communautaires (`/api/v1/community`)

Événements, demandes de prière partagées et annonces. Toutes les routes sont
**authentifiées**. L'**annuaire des groupes** vit dans le module `groups`
(cf. `GET /api/v1/groups/directory`, section 7) pour ne pas dupliquer sa logique.

**Portée de visibilité** : un utilisateur voit le contenu **global** (sans
groupe) et celui des **groupes dont il est membre actif** ; les demandes de
prière `public` sont visibles de tous.

### Événements

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/community/events` | Lister (filtres `?event_type=` `?status=` `?group_id=` `?from=` `?to=`, paginé) |
| `POST` | `/api/v1/community/events` | Créer (`{ title, start_date, event_type?, description?, end_date?, location_info?, cover_image_url?, group_id?, max_participants?, registration_required? }`) |
| `GET` | `/api/v1/community/events/:id` | Détail (+ `registrations_count`, `is_registered`) |
| `PATCH` | `/api/v1/community/events/:id` | Mettre à jour *(organisateur)* |
| `DELETE`| `/api/v1/community/events/:id` | Supprimer *(organisateur, soft delete)* |
| `POST` | `/api/v1/community/events/:id/register` | S'inscrire — **409 `EVENT_FULL`** si la capacité est atteinte |
| `DELETE`| `/api/v1/community/events/:id/register` | Annuler son inscription (libère une place) |
| `GET` | `/api/v1/community/events/:id/registrations` | Liste des inscrits *(organisateur uniquement)* |

Types : `retraite`, `formation`, `conference`, `autre`. Statuts : `upcoming`,
`ongoing`, `completed`, `cancelled`. Créer un événement de groupe exige d'en être
membre et **notifie les membres**. Le contrôle de capacité se fait **dans une
transaction avec verrou** sur l'événement (pas de dépassement en cas
d'inscriptions simultanées).

### Demandes de prière partagées

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/community/prayers` | Lister (filtres `?visibility=` `?status=` `?group_id=`, paginé) |
| `POST` | `/api/v1/community/prayers` | Partager (`{ title, description?, visibility?, group_id?, is_anonymous? }`) |
| `GET` | `/api/v1/community/prayers/:id` | Détail |
| `PATCH` | `/api/v1/community/prayers/:id` | Mettre à jour *(auteur)* — `status: 'answered'` + `answered_note` |
| `DELETE`| `/api/v1/community/prayers/:id` | Supprimer *(auteur, soft delete)* |
| `POST` | `/api/v1/community/prayers/:id/support` | **« Je prie pour toi »** — idempotent, notifie l'auteur |
| `DELETE`| `/api/v1/community/prayers/:id/support` | Retirer son soutien |

Visibilités : `public`, `group` (exige `group_id` + d'en être membre).
Statuts : `active`, `answered`, `closed`. Chaque demande expose
`supports_count`, `is_supported` et `is_mine`.

> 🔒 **Anonymat** : quand `is_anonymous`, l'auteur (`user_id`, `author_name`,
> `author_avatar`) est masqué **à la lecture** pour tout le monde ; seul
> `is_mine` permet à l'auteur de retrouver sa demande.

### Annonces

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/community/announcements` | Lister (filtre `?group_id=`, paginé) — **épinglées d'abord, puis priorité décroissante** ; les annonces expirées sont exclues |
| `POST` | `/api/v1/community/announcements` | Publier (`{ title, content, group_id?, is_pinned?, priority?, expires_at? }`) |
| `PATCH` | `/api/v1/community/announcements/:id` | Mettre à jour *(auteur)* |
| `DELETE`| `/api/v1/community/announcements/:id` | Supprimer *(auteur, soft delete)* |

**Droits de publication** : une annonce **globale** (sans `group_id`) est réservée
aux **administrateurs** (`ADMIN_EMAILS`) ; une annonce **de groupe** exige d'en
être **admin ou modérateur**.

> 🔔 **Notifications** : ce module ne redéfinit aucune logique de notification —
> il appelle `notifications.service.createNotification()`. L'enum
> `notification_type` étant partagé et sans valeur dédiée (`like`, `comment`,
> `follow`, `mention`, `groupe`, `systeme`), le type **`groupe`** est réutilisé
> pour tout le communautaire. Ajouter des types dédiés supposerait une migration
> `ALTER TYPE`.

---

## 👛 17. Portefeuille (`/api/v1/wallet`)

Portefeuille unique par utilisateur (devise **FCFA / XOF**). Gère à la fois le
suivi personnel (revenus/dépenses manuels catégorisés) et les transactions
réelles de la plateforme (rechargements CinetPay/FedaPay, abonnements CAMAJ+,
achats de crédits, factures Reçu+, commissions Ambassadeur). Toutes les routes
sont **authentifiées** et cloisonnées à l'utilisateur connecté, **sauf** le
webhook provider (public, vérifié par signature HMAC).

Le solde est modifié sous **verrou row-level** (`SELECT ... FOR UPDATE`) dans une
transaction ; aucune suppression physique de mouvement (soft delete + annulation
inverse traçable).

### Solde & mouvements

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/wallet` | Résumé : solde, devise, statut + historique paginé (`?page=` `?limit=`) |
| `GET` | `/api/v1/wallet/transactions` | Lister les mouvements — filtres `?type=credit\|debit` `?source=` `?category_id=` `?from=` `?to=`, paginé |
| `POST` | `/api/v1/wallet/income` | Revenu manuel → **crédite** (`{ amount, category_id?, description?, reference_type?, reference_id? }`) |
| `POST` | `/api/v1/wallet/expense` | Dépense manuelle → **débite** ; `400 INSUFFICIENT_BALANCE` si solde insuffisant |
| `POST` | `/api/v1/wallet/topup` | Initier un rechargement réel (`{ amount, provider }`) → renvoie `payment_url` *(provider en **stub**)* |
| `POST` | `/api/v1/wallet/transactions/:id/reverse` | Annuler une transaction (`{ reason? }`) → mouvement inverse, l'originale passe en `reversed` |

### Webhook provider (public)

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/wallet/webhook/:provider` | Callback provider (`cinetpay`\|`fedapay`). **Pas de JWT**, signature **HMAC**, **idempotent** (UNIQUE `provider`+`provider_tx_id`). Répond **toujours 200** (erreurs journalisées côté serveur) |

### Catégories

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/wallet/categories` | Lister les catégories système **+** personnelles (filtre `?type=income\|expense`) |
| `POST` | `/api/v1/wallet/categories` | Créer une catégorie personnalisée (`{ name, type, icon?, color? }`) |
| `PATCH` | `/api/v1/wallet/categories/:id` | Mettre à jour une catégorie personnalisée (catégories système non modifiables) |
| `DELETE`| `/api/v1/wallet/categories/:id` | Supprimer une catégorie personnalisée (soft delete) |

Types de mouvement : `credit`, `debit`. Sources : `manual`, `topup`,
`withdrawal`, `subscription`, `credit_purchase`, `invoice`, `commission`,
`refund`, `reversal`, `adjustment`. Statuts de mouvement : `pending`,
`completed`, `failed`, `reversed`, `cancelled`. Montants `NUMERIC(14,2)`
strictement positifs.

> ⚠️ **À compléter** : l'intégration réelle des providers est laissée en **stubs**
> commentés dans `wallet.service.js` (`verifyWebhookSignature`,
> `initiateProviderPayment`) et `wallet.controller.js` (`normalizeProviderPayload`).
> La vérification HMAC exige de capter le **corps brut** de la requête webhook
> (ex. `express.json({ verify })`).

---

## 🧾 18. Facturation — Reçu+ (`/api/v1/billing`)

Outil SaaS ouvert à **tout membre SHALOM connecté** : déclarer son entreprise,
gérer ses propres clients (simples contacts, pas forcément des comptes
SHALOM) et leur émettre des factures. Toutes les routes sont authentifiées.

### Entreprise

Une seule entreprise par compte. Toutes les routes clients/factures/paiements
exigent d'en avoir créé une (sinon **404 `BUSINESS_NOT_FOUND`**).

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/billing/businesses` | Créer son entreprise (`{ name, logo_url?, address?, phone?, tax_id?, currency?, invoice_prefix? }`) — **409 `BUSINESS_ALREADY_EXISTS`** si déjà créée |
| `GET` | `/api/v1/billing/businesses/me` | Récupérer son entreprise |
| `PATCH` | `/api/v1/billing/businesses/me` | Mettre à jour son entreprise |

### Clients

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/billing/clients` | Créer un client (`{ name, phone?, email?, address? }`) |
| `GET` | `/api/v1/billing/clients` | Lister ses clients, paginé |
| `PATCH` | `/api/v1/billing/clients/:id` | Mettre à jour un client |
| `DELETE`| `/api/v1/billing/clients/:id` | Supprimer un client (soft delete) |

### Factures

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/billing/invoices` | Créer une facture (`{ client_id, items: [{description, quantity, unit_price}], tax_rate?, issue_date?, due_date?, notes? }`) — numérotée automatiquement (`<invoice_prefix>-<année>-<0001>`) |
| `GET` | `/api/v1/billing/invoices` | Lister ses factures — filtre `?status=`, paginé |
| `GET` | `/api/v1/billing/invoices/:id` | Détail d'une facture avec ses lignes |
| `PATCH` | `/api/v1/billing/invoices/:id` | Mettre à jour (items, statut, échéance, notes...) — recalcule les totaux si `items` fourni |
| `DELETE`| `/api/v1/billing/invoices/:id` | Supprimer une facture (soft delete) |

Statuts : `draft`, `partial`, `paid`, `overdue` — calculé automatiquement à
partir de `amount_paid` / `total` / `due_date` (sauf si forcé explicitement
via `PATCH`). Montants en **entiers FCFA**, jamais de décimales.

### Paiements

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/billing/invoices/:id/payments` | Enregistrer un paiement (`{ amount, payment_method?, reference_id?, payment_date? }`) — **400 `PAYMENT_EXCEEDS_DUE`** si le montant dépasse le solde restant dû |
| `GET` | `/api/v1/billing/invoices/:id/payments` | Lister les paiements d'une facture |
| `DELETE`| `/api/v1/billing/payments/:paymentId` | Annuler un paiement (soft delete) — recalcule `amount_paid`/`status` de la facture |

> 👛 **Intégration Portefeuille (wallet)** : chaque paiement enregistré
> **crédite automatiquement le portefeuille SHALOM** du propriétaire de
> l'entreprise via `walletService.creditWallet()` — `source: 'invoice'`,
> `reference_type: 'recu_invoice'`, `reference_id: <invoice_id>` (cf. section
> 17). Le mouvement créé est tracé dans `payments.wallet_transaction_id`.
> Annuler un paiement appelle symétriquement `walletService.reverseTransaction()`.
> Le crédit/l'annulation wallet est une étape **séparée** de la transaction
> DB du paiement lui-même (le paiement reste acté même si le crédit wallet
> échoue — l'échec est journalisé côté serveur).

### Impression & partage WhatsApp

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/billing/invoices/:id/print` | Page HTML imprimable de la facture (bouton « Imprimer » intégré, `Ctrl+P` → Enregistrer en PDF) |
| `GET` | `/api/v1/billing/invoices/:id/whatsapp-link` | `{ whatsapp_url, public_url }` — lien `wa.me` pré-rempli vers le client, et lien public de la facture |
| `GET` | `/api/v1/billing/public/invoices/:token` | **Public, sans authentification** — même page imprimable, accessible via le `share_token` de la facture (celui envoyé dans le lien WhatsApp) |

Chaque facture a un `share_token` (UUID aléatoire, généré à la création,
colonne `invoices.share_token`) qui sert de secret d'accès à la route
publique — pas de compte SHALOM requis côté client pour consulter/imprimer
sa facture. `GET .../whatsapp-link` échoue en **400 `CLIENT_PHONE_MISSING`**
si le client n'a pas de numéro de téléphone renseigné. Aucune API WhatsApp
Business n'est utilisée : le lien `wa.me` ouvre WhatsApp (web ou mobile) avec
le message déjà rédigé, prêt à envoyer manuellement.

---

## 🕊️ 18. Programme Ambassadeur (`/api/v1/ambassador`)

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/ambassador/dashboard` | Tableau de bord ambassadeur (stats, solde, progression certification) |
| `POST` | `/api/v1/ambassador/join` | Rejoindre le programme ambassadeur (génère le code `SHLM-XXXXXX`) |
| `GET` | `/api/v1/ambassador/profile` | Récupérer son profil ambassadeur |
| `PATCH` | `/api/v1/ambassador/profile` | Mettre à jour sa biographie |
| `GET` | `/api/v1/ambassador/referral-link` | Obtenir les liens de parrainage (url direct + bouton WhatsApp prérempli) |
| `GET` | `/api/v1/ambassador/referrals` | Lister ses filleuls (`?status=registered\|subscribed\|qualified`) |
| `GET` | `/api/v1/ambassador/commissions/summary` | Résumé des commissions par statut (pending, approved, paid) |
| `GET` | `/api/v1/ambassador/commissions` | Lister l'historique détaillé des commissions (`?status=`, `?month=`) |
| `GET` | `/api/v1/ambassador/withdrawals` | Historique des retraits Mobile Money demandés |
| `POST` | `/api/v1/ambassador/withdrawals` | Demander un retrait (min 5 000 FCFA, max mensuel UEMOA vérifié) |

### 🛡️ Routes d'administration Ambassadeur

_Ces routes nécessitent que l'utilisateur soit un administrateur (email dans la variable `ADMIN_EMAILS`)._

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/ambassador/admin/list` | Lister tous les ambassadeurs |
| `PATCH` | `/api/v1/ambassador/admin/:id/level` | Forcer le changement de niveau (standard/certified) |
| `PATCH` | `/api/v1/ambassador/admin/:id/status` | Suspendre/Réactiver un ambassadeur |
| `GET` | `/api/v1/ambassador/admin/commissions` | Lister toutes les commissions générées par tous les ambassadeurs |
| `PATCH` | `/api/v1/ambassador/admin/commissions/:id` | **Approuver** une commission en attente (crédite le `available_balance` du parrain) |
| `PATCH` | `/api/v1/ambassador/admin/withdrawals/:id` | **Traiter** une demande de retrait (complétée, échouée — rembourse si échouée) |

## 📺 SHALOM TV (`/api/v1/shalom-tv`)

### Routes Publiques (Accessibles aux abonnés / essai gratuit)
| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/v1/shalom-tv` | Lister les contenus publiés (avec filtres `?target_audience=adult/child` et `?type=video/audio/text`) |
| `GET` | `/api/v1/shalom-tv/:id` | Récupérer un contenu spécifique (avec lecteur et ressources) |

### 🛡️ Routes Administrateur
| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/v1/shalom-tv` | Créer un nouveau contenu (upload multimédia direct) |
| `PUT` | `/api/v1/shalom-tv/:id` | Modifier un contenu existant (remplacer les médias, changer le titre) |
| `DELETE` | `/api/v1/shalom-tv/:id` | Supprimer un contenu (Soft delete) |
