-- ============================================================================
-- Migration: 023_games_questions_seed.sql
-- Module: SHALOM Games — banque de questions de démarrage (difficulté 1)
-- 10 questions par jeu MVP (quiz_biblique, complete_verset, qui_suis_je),
-- chacune avec 4 choix dont exactement un correct.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- QUIZ BIBLIQUE
-- ----------------------------------------------------------------------------

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'mcq', 1, 'Qui a construit l''arche pour survivre au déluge ?',
    'Genèse 6 à 9 raconte comment Noé construisit l''arche sur ordre de Dieu pour sauver sa famille et les animaux.',
    'Genèse 6-9', 10
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Noé', true, 1), ('Abraham', false, 2), ('Moïse', false, 3), ('David', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'ancien-testament'),
    'mcq', 1, 'Combien de jours et de nuits la pluie du déluge a-t-elle duré ?',
    'Genèse 7:12 précise que la pluie tomba sur la terre pendant quarante jours et quarante nuits.',
    'Genèse 7:12', 10
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('40 jours et 40 nuits', true, 1), ('7 jours', false, 2), ('100 jours', false, 3), ('3 jours et 3 nuits', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'mcq', 1, 'Qui a reçu les Dix Commandements sur le mont Sinaï ?',
    'Dieu remit les tables de la loi à Moïse sur le mont Sinaï.',
    'Exode 20', 10
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Moïse', true, 1), ('Josué', false, 2), ('Aaron', false, 3), ('Élie', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'nouveau-testament'),
    'mcq', 1, 'Dans quelle ville Jésus est-il né ?',
    'Jésus est né à Bethléem, en Judée, conformément à la prophétie de Michée.',
    'Matthieu 2:1', 10
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Bethléem', true, 1), ('Nazareth', false, 2), ('Jérusalem', false, 3), ('Capharnaüm', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'mcq', 1, 'Qui a trahi Jésus pour trente pièces d''argent ?',
    'Judas Iscariote livra Jésus aux chefs religieux contre trente pièces d''argent.',
    'Matthieu 26:15', 10
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Judas Iscariote', true, 1), ('Pierre', false, 2), ('Thomas', false, 3), ('Jean', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'nouveau-testament'),
    'mcq', 1, 'Combien d''apôtres Jésus a-t-il choisis ?',
    'Jésus choisit douze apôtres parmi ses disciples.',
    'Luc 6:13', 10
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('12', true, 1), ('10', false, 2), ('7', false, 3), ('70', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'mcq', 1, 'Qui a vaincu le géant Goliath avec une fronde ?',
    'Le jeune David terrassa le géant philistin Goliath avec une fronde et une pierre.',
    '1 Samuel 17', 10
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('David', true, 1), ('Saül', false, 2), ('Samson', false, 3), ('Salomon', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'ancien-testament'),
    'mcq', 1, 'Quel est le premier livre de la Bible ?',
    'La Genèse ouvre l''Ancien Testament en racontant la création du monde.',
    'Genèse 1:1', 10
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Genèse', true, 1), ('Exode', false, 2), ('Psaumes', false, 3), ('Matthieu', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'mcq', 1, 'Qui a été avalé par un grand poisson après avoir fui la mission que Dieu lui avait confiée ?',
    'Jonas fut englouti par un grand poisson pendant trois jours avant d''être rejeté sur le rivage.',
    'Jonas 1-2', 10
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Jonas', true, 1), ('Daniel', false, 2), ('Élie', false, 3), ('Jérémie', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'quiz_biblique'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'mcq', 1, 'Qui a interprété les rêves du Pharaon en Égypte ?',
    'Joseph interpréta les rêves de Pharaon annonçant sept années d''abondance suivies de sept années de famine.',
    'Genèse 41', 10
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Joseph', true, 1), ('Benjamin', false, 2), ('Ruben', false, 3), ('Juda', false, 4)) AS v(choice_text, is_correct, display_order);

-- ----------------------------------------------------------------------------
-- COMPLÈTE LE VERSET
-- ----------------------------------------------------------------------------

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 1,
    'Complète le verset : « Car Dieu a tant aimé le monde qu''il a donné son Fils unique, afin que quiconque croit en lui ne ______ point, mais qu''il ait la vie éternelle. »',
    'Jean 3:16 est l''un des versets les plus connus de la Bible.',
    'Jean 3:16', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('périsse', true, 1), ('dorme', false, 2), ('pleure', false, 3), ('tombe', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 1,
    'Complète le verset : « L''Éternel est mon ______, je ne manquerai de rien. »',
    'Le psaume 23 décrit Dieu comme un berger qui prend soin de son troupeau.',
    'Psaume 23:1', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('berger', true, 1), ('roi', false, 2), ('juge', false, 3), ('ami', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 1,
    'Complète le verset : « Je puis tout par celui qui me ______. »',
    'Paul affirme que sa force vient du Christ qui le fortifie.',
    'Philippiens 4:13', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('fortifie', true, 1), ('protège', false, 2), ('console', false, 3), ('guide', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 1,
    'Complète le verset : « Cherchez premièrement le ______ de Dieu et sa justice, et toutes ces choses vous seront données par-dessus. »',
    'Jésus invite à donner la priorité au royaume de Dieu plutôt qu''aux soucis matériels.',
    'Matthieu 6:33', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('royaume', true, 1), ('temple', false, 2), ('pardon', false, 3), ('salut', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 1,
    'Complète le verset : « Toutes choses concourent au bien de ceux qui ______ Dieu. »',
    'Paul rassure les croyants que Dieu fait concourir toutes choses à leur bien.',
    'Romains 8:28', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('aiment', true, 1), ('craignent', false, 2), ('cherchent', false, 3), ('servent', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 1,
    'Complète le verset : « Confie-toi en l''Éternel de tout ton ______, et ne t''appuie pas sur ta sagesse. »',
    'Ce proverbe invite à faire confiance à Dieu plutôt qu''à sa propre compréhension.',
    'Proverbes 3:5', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('cœur', true, 1), ('esprit', false, 2), ('âme', false, 3), ('corps', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 1,
    'Complète le verset : « Sois fort et ______, ne t''effraie point, car l''Éternel, ton Dieu, est avec toi. »',
    'Dieu encourage Josué à être fort et courageux avant d''entrer en Terre promise.',
    'Josué 1:9', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('courageux', true, 1), ('sage', false, 2), ('riche', false, 3), ('patient', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 1,
    'Complète le verset : « Je suis le chemin, la ______ et la vie. »',
    'Jésus se présente comme l''unique chemin vers le Père.',
    'Jean 14:6', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('vérité', true, 1), ('lumière', false, 2), ('paix', false, 3), ('grâce', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 1,
    'Complète le verset : « Le fruit de l''Esprit, c''est l''amour, la joie, la ______, la patience, la bonté... »',
    'Paul énumère le fruit de l''Esprit dans sa lettre aux Galates.',
    'Galates 5:22', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('paix', true, 1), ('gloire', false, 2), ('foi', false, 3), ('sagesse', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'complete_verset'),
    (SELECT id FROM game_categories WHERE slug = 'versets-cles'),
    'fill_blank', 1,
    'Complète le verset : « Heureux ceux qui procurent la ______, car ils seront appelés fils de Dieu. »',
    'L''une des Béatitudes prononcées par Jésus dans le Sermon sur la montagne.',
    'Matthieu 5:9', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('paix', true, 1), ('justice', false, 2), ('vérité', false, 3), ('grâce', false, 4)) AS v(choice_text, is_correct, display_order);

-- ----------------------------------------------------------------------------
-- QUI SUIS-JE ?
-- ----------------------------------------------------------------------------

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 1,
    'Je suis né dans une famille de bergers. Dieu m''a choisi tout jeune pour devenir roi d''Israël, et j''ai vaincu un géant avec une simple fronde. Qui suis-je ?',
    'Il s''agit de David, futur roi d''Israël, vainqueur de Goliath.',
    '1 Samuel 16-17', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('David', true, 1), ('Saül', false, 2), ('Salomon', false, 3), ('Samuel', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 1,
    'Mes frères m''ont vendu comme esclave par jalousie, mais Dieu a fait de moi le gouverneur de l''Égypte. Qui suis-je ?',
    'Joseph, fils de Jacob, devint le second de Pharaon en Égypte.',
    'Genèse 37-45', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Joseph', true, 1), ('Benjamin', false, 2), ('Ruben', false, 3), ('Jacob', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 1,
    'J''ai conduit le peuple d''Israël hors d''Égypte après avoir vu un buisson ardent qui ne se consumait pas. Qui suis-je ?',
    'Moïse reçut l''appel de Dieu au buisson ardent avant de libérer le peuple hébreu.',
    'Exode 3', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Moïse', true, 1), ('Aaron', false, 2), ('Josué', false, 3), ('Élie', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 1,
    'Je suis la mère de Jésus. Un ange m''a annoncé que j''allais enfanter le Fils de Dieu. Qui suis-je ?',
    'L''ange Gabriel annonça à Marie qu''elle enfanterait Jésus.',
    'Luc 1:26-38', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Marie', true, 1), ('Marthe', false, 2), ('Élisabeth', false, 3), ('Anne', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 1,
    'J''étais pêcheur avant que Jésus ne m''appelle à devenir « pêcheur d''hommes ». Je suis considéré comme le chef des apôtres. Qui suis-je ?',
    'Simon-Pierre, pêcheur de Galilée, devint l''un des principaux apôtres de Jésus.',
    'Matthieu 4:18-19', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Pierre', true, 1), ('André', false, 2), ('Jacques', false, 3), ('Jean', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 1,
    'J''ai trahi mon maître pour trente pièces d''argent avant de mourir rongé par le remords. Qui suis-je ?',
    'Judas Iscariote livra Jésus puis se pendit de désespoir.',
    'Matthieu 27:3-5', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Judas Iscariote', true, 1), ('Thomas', false, 2), ('Philippe', false, 3), ('Barthélemy', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 1,
    'J''ai été jeté dans une fosse aux lions pour avoir continué à prier mon Dieu, mais j''en suis sorti indemne. Qui suis-je ?',
    'Daniel fut protégé par Dieu dans la fosse aux lions.',
    'Daniel 6', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Daniel', true, 1), ('Ézéchiel', false, 2), ('Jérémie', false, 3), ('Ésaïe', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 1,
    'J''ai combattu les Philistins avec une force surhumaine, jusqu''à ce que Dalila découvre le secret de ma force cachée dans mes cheveux. Qui suis-je ?',
    'Samson, juge d''Israël, perdit sa force lorsque ses cheveux furent coupés.',
    'Juges 13-16', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Samson', true, 1), ('Gédéon', false, 2), ('Josué', false, 3), ('Boaz', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 1,
    'Je doutais de la résurrection de Jésus jusqu''à ce que je touche ses plaies de mes propres mains. Qui suis-je ?',
    'L''apôtre Thomas exigea de voir les plaies de Jésus avant de croire.',
    'Jean 20:24-29', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Thomas', true, 1), ('Pierre', false, 2), ('Jean', false, 3), ('André', false, 4)) AS v(choice_text, is_correct, display_order);

WITH q AS (
  INSERT INTO questions (game_id, category_id, question_type, difficulty, prompt, explanation, scripture_ref, base_points)
  VALUES (
    (SELECT id FROM games WHERE code = 'qui_suis_je'),
    (SELECT id FROM game_categories WHERE slug = 'personnages'),
    'image_guess', 1,
    'J''étais reine de Perse et j''ai risqué ma vie en me présentant devant le roi sans y être invitée pour sauver mon peuple juif d''un complot d''extermination. Qui suis-je ?',
    'La reine Esther intervint auprès du roi Assuérus pour sauver les Juifs de Perse.',
    'Esther 4-7', 15
  ) RETURNING id
)
INSERT INTO question_choices (question_id, choice_text, is_correct, display_order)
SELECT id, v.choice_text, v.is_correct, v.display_order FROM q,
(VALUES ('Esther', true, 1), ('Ruth', false, 2), ('Rahab', false, 3), ('Débora', false, 4)) AS v(choice_text, is_correct, display_order);
