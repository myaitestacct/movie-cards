<?php
// api.php - NO whitespace before this line!

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header("Content-Type: application/json");
// Same-origin only: the frontend calls this endpoint with relative URLs,
// so no Access-Control-Allow-* headers are sent on purpose.

// ===== LOAD DATABASE CONFIGURATION =====
$config = require __DIR__ . '/config.php';

$host = $config['host'];
$db   = $config['db'];
$user = $config['user'];
$pass = $config['pass'];
$charset = $config['charset'];
$table = $config['table'];

// ===== POSTER PATH CONFIGURATION =====
// "path" is checked with file_exists(), "url" is what the browser loads.
$posterConfig = [
    'movies'    => ['path' => '../movies/antexport/',          'url' => '/movies/antexport/'],
    'paripakva' => ['path' => '../movies_template/paripakva/', 'url' => '/movies_template/paripakva/'],
];
$noPosterFileName = 'movies_0000-coming_soon.jpg';
// ====================================

// ===== MOVIE COLUMNS =====
// SUBTITLES is appended per request: it exists in some databases, not others.
$baseMovieColumns = 'NUM, FORMATTEDTITLE, YEAR, CATEGORY, RATING, USERRATING, DESCRIPTION, '
    . 'CERTIFICATION, DIRECTOR, ACTORS, URL, PICTURENAME, LENGTH, COUNTRY, '
    . 'RESOLUTION, AUDIOFORMAT, FILESIZE, FILEPATH';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// ===== SOURCE TABLE (whitelisted, shared by every query) =====
$useParipakva = isset($_GET['archive']) && $_GET['archive'] == 1;
$allowedTables = [$table, 'paripakva'];
$tableToQuery = resolveMovieTable($table, $useParipakva, $allowedTables);

if ($tableToQuery === null) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid table']);
    exit;
}

// ===== OPTIONAL COLUMNS =====
// Subtitles live in a column that only some databases have. When it is missing
// every query still works - the column is selected as NULL and the subtitle
// filters simply report "nothing has subtitles".
$subtitlesColumn = findColumn($pdo, $tableToQuery, ['SUBTITLES', 'SUBTITLE', 'SUBS', 'SUBTITLELANGUAGE']);
$quoteSubtitles = $subtitlesColumn !== null ? '`' . $subtitlesColumn . '`' : null;

$movieColumns = $baseMovieColumns . ', '
    . ($quoteSubtitles !== null ? "$quoteSubtitles AS SUBTITLES" : 'NULL AS SUBTITLES');

// ===== HANDLE SPECIAL ACTIONS =====
$action = isset($_GET['action']) ? trim($_GET['action']) : '';

if ($action === 'categories') {
    try {
        $catStmt = $pdo->prepare("SELECT DISTINCT CATEGORY FROM $tableToQuery WHERE CATEGORY IS NOT NULL AND CATEGORY != '' ORDER BY CATEGORY ASC");
        $catStmt->execute();
        $categories = array_column($catStmt->fetchAll(), 'CATEGORY');
        echo json_encode(['categories' => $categories]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch categories']);
    }
    exit;
}

if ($action === 'stats') {
    try {
        // Total movies
        $totalStmt = $pdo->prepare("SELECT COUNT(*) as total FROM $tableToQuery");
        $totalStmt->execute();
        $totalMovies = $totalStmt->fetch()['total'] ?? 0;

        // Average rating
        $avgStmt = $pdo->prepare("SELECT AVG(COALESCE(NULLIF(USERRATING, ''), RATING)) as avg_rating FROM $tableToQuery WHERE COALESCE(NULLIF(USERRATING, ''), RATING) IS NOT NULL AND COALESCE(NULLIF(USERRATING, ''), RATING) > 0");
        $avgStmt->execute();
        $avgRating = round($avgStmt->fetch()['avg_rating'] ?? 0, 1);

        // Most common genre
        $genreStmt = $pdo->prepare("SELECT CATEGORY, COUNT(*) as cnt FROM $tableToQuery WHERE CATEGORY IS NOT NULL AND CATEGORY != '' GROUP BY CATEGORY ORDER BY cnt DESC LIMIT 1");
        $genreStmt->execute();
        $topGenreRow = $genreStmt->fetch();
        $topGenre = $topGenreRow ? $topGenreRow['CATEGORY'] : 'N/A';
        $topGenreCount = $topGenreRow ? $topGenreRow['cnt'] : 0;

        // Total runtime (from the LENGTH field, cached - see the helper)
        $totalMinutes = sumRuntimeMinutesCached($pdo, $tableToQuery);

        echo json_encode([
            'totalMovies' => (int)$totalMovies,
            'avgRating' => $avgRating,
            'topGenre' => $topGenre,
            'topGenreCount' => (int)$topGenreCount,
            'totalRuntime' => formatRuntime($totalMinutes),
            'totalRuntimeMinutes' => $totalMinutes
        ]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch stats']);
    }
    exit;
}

// ===== ANALYTICS: collection growth & timeline =====
if ($action === 'analytics') {
    try {
        // Movies per release year (dirty YEAR values are ignored, not cast to 0)
        $yearStmt = $pdo->prepare("SELECT CAST(YEAR AS UNSIGNED) AS year,
                                          COUNT(*) AS count,
                                          AVG(CAST(COALESCE(NULLIF(USERRATING, ''), RATING) AS DECIMAL(4,1))) AS avg_rating
                                   FROM $tableToQuery
                                   WHERE YEAR IS NOT NULL AND CAST(YEAR AS UNSIGNED) BETWEEN 1888 AND 2100
                                   GROUP BY CAST(YEAR AS UNSIGNED)
                                   ORDER BY year ASC");
        $yearStmt->execute();
        $byYear = [];
        foreach ($yearStmt->fetchAll() as $row) {
            $byYear[] = [
                'year' => (int)$row['year'],
                'count' => (int)$row['count'],
                'avgRating' => $row['avg_rating'] !== null ? round((float)$row['avg_rating'], 1) : null
            ];
        }

        // Decades are derived from the yearly series so both charts always agree
        $byDecade = buildDecadeSeries($byYear);

        $byGenre = fetchTopGroups($pdo, $tableToQuery, 'CATEGORY', 12);
        $byCountry = fetchTopGroups($pdo, $tableToQuery, 'COUNTRY', 8);
        $byDirector = fetchTopGroups($pdo, $tableToQuery, 'DIRECTOR', 8);

        $totalsStmt = $pdo->prepare("SELECT COUNT(*) AS total,
                                            SUM(CAST(FILESIZE AS DECIMAL(12,2))) AS size_mb,
                                            MIN(CAST(YEAR AS UNSIGNED)) AS first_year,
                                            MAX(CAST(YEAR AS UNSIGNED)) AS last_year
                                     FROM $tableToQuery");
        $totalsStmt->execute();
        $totals = $totalsStmt->fetch() ?: [];

        $minutes = sumRuntimeMinutesCached($pdo, $tableToQuery);
        $totalMovies = (int)($totals['total'] ?? 0);
        $sizeMb = (float)($totals['size_mb'] ?? 0);
        $firstYear = !empty($totals['first_year']) ? (int)$totals['first_year'] : null;
        $lastYear = !empty($totals['last_year']) ? (int)$totals['last_year'] : null;

        // Optional: a date-added column turns "growth" into acquisition growth.
        // Everything here is best-effort - a missing column or a restricted
        // information_schema must never break the endpoint.
        $addedSeries = null;
        $dateColumn = findDateColumn($pdo, $tableToQuery);
        if ($dateColumn !== null) {
            try {
                $addedStmt = $pdo->prepare("SELECT DATE_FORMAT(`$dateColumn`, '%Y-%m') AS month, COUNT(*) AS count
                                            FROM $tableToQuery
                                            WHERE `$dateColumn` IS NOT NULL AND `$dateColumn` > '1970-01-01'
                                            GROUP BY month
                                            ORDER BY month ASC");
                $addedStmt->execute();
                $rows = $addedStmt->fetchAll();
                if (!empty($rows)) {
                    $addedSeries = array_map(function ($row) {
                        return ['month' => $row['month'], 'count' => (int)$row['count']];
                    }, $rows);
                }
            } catch (\PDOException $e) {
                $addedSeries = null; // column exists but is not a usable date
            }
        }

        echo json_encode([
            'totalMovies' => $totalMovies,
            'totalRuntime' => formatRuntime($minutes),
            'totalRuntimeMinutes' => $minutes,
            'totalSizeMb' => round($sizeMb, 1),
            'firstYear' => $firstYear,
            'lastYear' => $lastYear,
            'byYear' => $byYear,
            'byDecade' => $byDecade,
            'byGenre' => $byGenre,
            'byCountry' => $byCountry,
            'byDirector' => $byDirector,
            'dateColumn' => $dateColumn,
            'addedByMonth' => $addedSeries,
            'source' => $useParipakva ? 'paripakva' : 'movies'
        ]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to build analytics']);
    }
    exit;
}

// ===== DECADES: decade chips with counts and average ratings =====
if ($action === 'decades') {
    try {
        $stmt = $pdo->prepare("SELECT CAST(YEAR AS UNSIGNED) AS year,
                                      COUNT(*) AS count,
                                      AVG(CAST(COALESCE(NULLIF(USERRATING, ''), RATING) AS DECIMAL(4,1))) AS avg_rating
                               FROM $tableToQuery
                               WHERE YEAR IS NOT NULL AND CAST(YEAR AS UNSIGNED) BETWEEN 1888 AND 2100
                               GROUP BY CAST(YEAR AS UNSIGNED)
                               ORDER BY year ASC");
        $stmt->execute();

        $byYear = array_map(function ($row) {
            return [
                'year' => (int)$row['year'],
                'count' => (int)$row['count'],
                'avgRating' => $row['avg_rating'] !== null ? round((float)$row['avg_rating'], 1) : null
            ];
        }, $stmt->fetchAll());

        $decades = array_map(function ($d) {
            return [
                'decade' => $d['decade'],
                'label' => $d['decade'] . 's',
                'count' => $d['count'],
                'avgRating' => $d['avgRating'],
            ];
        }, buildDecadeSeries($byYear));

        echo json_encode([
            'success' => true,
            'decades' => $decades,
            'source' => $useParipakva ? 'paripakva' : 'movies'
        ]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to fetch decades']);
    }
    exit;
}

// ===== INDEX: compact full-collection list for client-side caching =====
// Returns every movie as {num, title, year} ordered by NUM ASC. The frontend
// caches this (memory + localStorage) so letter/decade browsing and page
// previews work instantly and without the 100-row endpoint cap. Keep the
// payload lean: no descriptions, posters or other heavy fields.
if ($action === 'index') {
    try {
        $stmt = $pdo->prepare("SELECT NUM, FORMATTEDTITLE, YEAR FROM $tableToQuery ORDER BY NUM ASC");
        $stmt->execute();

        $movies = [];
        foreach ($stmt->fetchAll() as $row) {
            $movies[] = [
                'num'   => (int)$row['NUM'],
                'title' => (string)($row['FORMATTEDTITLE'] ?? ''),
                'year'  => $row['YEAR'] !== null ? (string)$row['YEAR'] : '',
            ];
        }

        echo json_encode([
            'success' => true,
            'source'  => $useParipakva ? 'paripakva' : 'movies',
            'count'   => count($movies),
            'movies'  => $movies,
        ]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to build index']);
    }
    exit;
}

// ===== QUICK JUMP ACTIONS =====

// Jump to a single movie by its NUM
if ($action === 'get_movie_by_num') {
    $num = isset($_GET['num']) ? (int)$_GET['num'] : 0;

    if ($num <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid movie number']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT $movieColumns FROM $tableToQuery WHERE NUM = :num LIMIT 1");
        $stmt->bindValue(':num', $num, PDO::PARAM_INT);
        $stmt->execute();
        $row = $stmt->fetch();

        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => "No movie #$num found"]);
            exit;
        }

        echo json_encode([
            'success' => true,
            'movie' => mapMovieRow($row, $useParipakva, $posterConfig, $noPosterFileName),
        ]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Query failed']);
    }
    exit;
}

// Jump to movies whose title starts with a letter ("#" or "[0-9]" = any digit)
if ($action === 'get_movies_by_letter') {
    $letter = isset($_GET['letter']) ? trim($_GET['letter']) : '';
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
    $limit = max(1, min($limit, 100));

    if ($letter === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Missing letter']);
        exit;
    }

    $digitsOnly = ($letter === '#' || $letter === '[0-9]');

    try {
        if ($digitsOnly) {
            // MySQL LIKE has no character classes, so digits need REGEXP
            $stmt = $pdo->prepare("SELECT $movieColumns FROM $tableToQuery
                                   WHERE FORMATTEDTITLE IS NOT NULL AND FORMATTEDTITLE REGEXP '^[0-9]'
                                   ORDER BY FORMATTEDTITLE ASC
                                   LIMIT :limit");
        } else {
            $stmt = $pdo->prepare("SELECT $movieColumns FROM $tableToQuery
                                   WHERE FORMATTEDTITLE IS NOT NULL AND FORMATTEDTITLE LIKE :pattern
                                   ORDER BY FORMATTEDTITLE ASC
                                   LIMIT :limit");
            $stmt->bindValue(':pattern', escapeLike($letter) . '%', PDO::PARAM_STR);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        $movies = array_map(function ($row) use ($useParipakva, $posterConfig, $noPosterFileName) {
            return mapMovieRow($row, $useParipakva, $posterConfig, $noPosterFileName);
        }, $stmt->fetchAll());

        echo json_encode([
            'success' => true,
            'letter' => $digitsOnly ? '#' : $letter,
            'count' => count($movies),
            'movies' => $movies,
        ]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Query failed']);
    }
    exit;
}

// Jump to movies released in a decade ("from" and "to" are both inclusive)
if ($action === 'get_movies_by_decade') {
    $from = isset($_GET['from']) ? (int)$_GET['from'] : 0;
    $to   = isset($_GET['to']) ? (int)$_GET['to'] : 0;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
    $limit = max(1, min($limit, 100));

    if ($from < 1000 || $to < $from) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid year range']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("SELECT $movieColumns FROM $tableToQuery
                               WHERE CAST(YEAR AS UNSIGNED) BETWEEN :from AND :to
                               ORDER BY CAST(YEAR AS UNSIGNED) ASC, FORMATTEDTITLE ASC
                               LIMIT :limit");
        $stmt->bindValue(':from', $from, PDO::PARAM_INT);
        $stmt->bindValue(':to', $to, PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        $movies = array_map(function ($row) use ($useParipakva, $posterConfig, $noPosterFileName) {
            return mapMovieRow($row, $useParipakva, $posterConfig, $noPosterFileName);
        }, $stmt->fetchAll());

        echo json_encode([
            'success' => true,
            'from' => $from,
            'to' => $to,
            'count' => count($movies),
            'movies' => $movies,
        ]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Query failed']);
    }
    exit;
}
// ================================

// ===== PAGINATION PARAMETERS =====
$query = isset($_GET['q']) ? trim($_GET['q']) : '';
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
$offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
$category = isset($_GET['category']) ? trim($_GET['category']) : '';
$favsParam = isset($_GET['favs']) ? trim($_GET['favs']) : '';

// ===== ADVANCED FILTER PARAMETERS =====
$yearFrom = isset($_GET['year_from']) ? (int)$_GET['year_from'] : 0;
$yearTo = isset($_GET['year_to']) ? (int)$_GET['year_to'] : 0;
$decade = isset($_GET['decade']) ? (int)$_GET['decade'] : 0;
$ratingFrom = isset($_GET['rating_from']) ? (float)$_GET['rating_from'] : 0;
$ratingTo = isset($_GET['rating_to']) ? (float)$_GET['rating_to'] : 0;
$resolutionsParam = isset($_GET['resolutions']) ? trim($_GET['resolutions']) : '';
$audioParam = isset($_GET['audio']) ? trim($_GET['audio']) : '';
$countryParam = isset($_GET['country']) ? trim($_GET['country']) : '';
$directorParam = isset($_GET['director']) ? trim($_GET['director']) : '';
$actorsParam = isset($_GET['actors']) ? trim($_GET['actors']) : '';
$sizeFrom = isset($_GET['size_from']) ? (float)$_GET['size_from'] : 0;
$sizeTo = isset($_GET['size_to']) ? (float)$_GET['size_to'] : 0;
$certificationsParam = isset($_GET['certifications']) ? trim($_GET['certifications']) : '';
$subtitlesParam = isset($_GET['subtitles']) ? trim($_GET['subtitles']) : '';
$subPresenceParam = isset($_GET['sub_presence']) ? trim($_GET['sub_presence']) : '';   // '' = any, '1' = has, '0' = none

// Parse comma-separated values
$resolutions = $resolutionsParam ? array_filter(array_map('trim', explode(',', $resolutionsParam))) : [];
$audioFormats = $audioParam ? array_filter(array_map('trim', explode(',', $audioParam))) : [];
$certifications = $certificationsParam ? array_filter(array_map('trim', explode(',', $certificationsParam))) : [];
$subtitleLanguages = $subtitlesParam ? array_filter(array_map('trim', explode(',', $subtitlesParam))) : [];

// Cap limit to prevent abuse
$limit = min($limit, 100);
if ($limit < 1) $limit = 50;
if ($offset < 0) $offset = 0;

// Sanitize search query (strip null bytes, limit length)
$query = str_replace("\0", '', $query);
$query = mb_substr($query, 0, 200);

// Wildcards the user typed must match literally ("50%" searches for the text,
// not for everything), exactly like the letter and subtitle filters below.
$searchTerm = '%' . escapeLike($query) . '%';

// ===== SORT PARAMETER =====
$sort = isset($_GET['sort']) ? trim($_GET['sort']) : 'num_asc';

$allowedSorts = [
    'num_asc'      => 'NUM ASC',
    'num_desc'     => 'NUM DESC',
    'title_asc'    => 'FORMATTEDTITLE ASC',
    'title_desc'   => 'FORMATTEDTITLE DESC',
    'year_asc'     => 'YEAR ASC',
    'year_desc'     => 'YEAR DESC',
    'rating_asc'   => 'COALESCE(NULLIF(USERRATING, \'\'), RATING) ASC',
    'rating_desc'  => 'COALESCE(NULLIF(USERRATING, \'\'), RATING) DESC',
];

if (!array_key_exists($sort, $allowedSorts)) {
    $sort = 'num_asc';
}

$orderBy = $allowedSorts[$sort];

// Build query with pagination
// COALESCE every searchable column: NULL LIKE '%' is NULL (not true), so without
// it any row with an empty title/category would vanish even with no search term.
$conditions = ["(COALESCE(FORMATTEDTITLE, '') LIKE :search1 OR COALESCE(CATEGORY, '') LIKE :search2 OR COALESCE(DIRECTOR, '') LIKE :search3 OR COALESCE(ACTORS, '') LIKE :search4 OR COALESCE(CAST(YEAR AS CHAR), '') LIKE :search5)"];
if ($category !== '') {
    $conditions[] = "CATEGORY = :category";
}

// Favorites filter: comma-separated NUM values
$favIds = [];
$favBindings = [];
if ($favsParam !== '') {
    $rawIds = explode(',', $favsParam);
    foreach ($rawIds as $i => $id) {
        $id = (int)trim($id);
        if ($id > 0) {
            $favIds[] = $id;
            $favBindings[":fav$i"] = $id;
        }
    }
    if (!empty($favIds)) {
        $placeholders = implode(',', array_keys($favBindings));
        $conditions[] = "NUM IN ($placeholders)";
    } else {
        // Empty favorites list — return nothing
        $conditions[] = "1 = 0";
    }
}

// Advanced filters
$advancedBindings = [];
if ($yearFrom > 0) {
    $conditions[] = "CAST(YEAR AS UNSIGNED) >= :year_from";
    $advancedBindings[':year_from'] = $yearFrom;
}
if ($yearTo > 0) {
    $conditions[] = "CAST(YEAR AS UNSIGNED) <= :year_to";
    $advancedBindings[':year_to'] = $yearTo;
}
if ($decade > 0) {
    $conditions[] = "CAST(YEAR AS UNSIGNED) BETWEEN :decade_from AND :decade_to";
    $advancedBindings[':decade_from'] = $decade;
    $advancedBindings[':decade_to'] = $decade + 9;
}
// Subtitle filters need the column; without it "has subtitles" can only be empty.
if ($subPresenceParam !== '' || !empty($subtitleLanguages)) {
    if ($quoteSubtitles === null) {
        if ($subPresenceParam === '0' && empty($subtitleLanguages)) {
            // no column means nothing is recorded - "no subtitles" matches everything
        } else {
            $conditions[] = '1 = 0';
        }
    } else {
        if ($subPresenceParam === '1') {
            $conditions[] = "($quoteSubtitles IS NOT NULL AND TRIM($quoteSubtitles) != '' AND $quoteSubtitles <> 'None')";
        } elseif ($subPresenceParam === '0') {
            $conditions[] = "($quoteSubtitles IS NULL OR TRIM($quoteSubtitles) = '' OR $quoteSubtitles = 'None')";
        }
        if (!empty($subtitleLanguages)) {
            $subConditions = [];
            foreach ($subtitleLanguages as $i => $language) {
                $subConditions[] = "$quoteSubtitles LIKE :sub$i";
                $advancedBindings[":sub$i"] = '%' . escapeLike($language) . '%';
            }
            $conditions[] = '(' . implode(' OR ', $subConditions) . ')';
        }
    }
}
if ($ratingFrom > 0) {
    $conditions[] = "COALESCE(NULLIF(USERRATING, ''), RATING) >= :rating_from";
    $advancedBindings[':rating_from'] = $ratingFrom;
}
if ($ratingTo > 0) {
    $conditions[] = "COALESCE(NULLIF(USERRATING, ''), RATING) <= :rating_to";
    $advancedBindings[':rating_to'] = $ratingTo;
}
if (!empty($resolutions)) {
    $resConditions = [];
    foreach ($resolutions as $i => $res) {
        $res = (int)$res;
        if ($res > 0) {
            $resConditions[] = "RESOLUTION LIKE :res$i";
            $advancedBindings[":res$i"] = "%{$res}%";
        }
    }
    if (!empty($resConditions)) {
        $conditions[] = '(' . implode(' OR ', $resConditions) . ')';
    }
}
if (!empty($audioFormats)) {
    $audioConditions = [];
    foreach ($audioFormats as $i => $audio) {
        $audio = trim($audio);
        if ($audio !== '') {
            $audioConditions[] = "AUDIOFORMAT LIKE :audio$i";
            $advancedBindings[":audio$i"] = "%{$audio}%";
        }
    }
    if (!empty($audioConditions)) {
        $conditions[] = '(' . implode(' OR ', $audioConditions) . ')';
    }
}
if ($countryParam !== '') {
    $conditions[] = "COUNTRY LIKE :country";
    $advancedBindings[':country'] = '%' . escapeLike($countryParam) . '%';
}
if ($directorParam !== '') {
    $conditions[] = "DIRECTOR LIKE :director";
    $advancedBindings[':director'] = '%' . escapeLike($directorParam) . '%';
}
if ($actorsParam !== '') {
    $conditions[] = "ACTORS LIKE :actors";
    $advancedBindings[':actors'] = '%' . escapeLike($actorsParam) . '%';
}
if ($sizeFrom > 0) {
    $conditions[] = "CAST(FILESIZE AS DECIMAL(10,2)) >= :size_from";
    $advancedBindings[':size_from'] = $sizeFrom;
}
if ($sizeTo > 0) {
    $conditions[] = "CAST(FILESIZE AS DECIMAL(10,2)) <= :size_to";
    $advancedBindings[':size_to'] = $sizeTo;
}
if (!empty($certifications)) {
    $certConditions = [];
    foreach ($certifications as $i => $cert) {
        $cert = trim($cert);
        if ($cert !== '') {
            $certConditions[] = "CERTIFICATION = :cert$i";
            $advancedBindings[":cert$i"] = $cert;
        }
    }
    if (!empty($certConditions)) {
        $conditions[] = '(' . implode(' OR ', $certConditions) . ')';
    }
}

$whereClause = implode(' AND ', $conditions);

$sql = "SELECT $movieColumns
        FROM $tableToQuery
        WHERE $whereClause
        ORDER BY $orderBy 
        LIMIT :limit OFFSET :offset";

try {
    $stmt = $pdo->prepare($sql);
    bindListQueryParams($stmt, $searchTerm, $category, $favBindings, $advancedBindings);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    
    $stmt->execute();
    $rows = $stmt->fetchAll();
    
    // ===== PAGINATION LOGIC =====
    $returnedCount = count($rows);
    // Provisional answer: the exact one is computed from the COUNT(*) below.
    $hasMore = ($returnedCount === $limit);
    
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Query failed']);
    exit;
}

// ===== GET TOTAL MATCHING RESULTS =====
try {
    $countStmt = $pdo->prepare("SELECT COUNT(*) as total FROM $tableToQuery WHERE $whereClause");
    bindListQueryParams($countStmt, $searchTerm, $category, $favBindings, $advancedBindings);
    $countStmt->execute();
    $totalResult = $countStmt->fetch();
    $totalMatches = (int)($totalResult['total'] ?? 0);
    // "Returned exactly limit rows" is NOT proof of another page (a total that is an
    // exact multiple of the page size used to produce a dead Load More button).
    // Only the real total can answer this.
    $hasMore = ($offset + $returnedCount) < $totalMatches;
} catch (\PDOException $e) {
    $totalMatches = 0; // fallback
}

// Map DB Columns to Frontend Model
$movies = array_map(function ($row) use ($useParipakva, $posterConfig, $noPosterFileName) {
    return mapMovieRow($row, $useParipakva, $posterConfig, $noPosterFileName);
}, $rows);

// Return paginated response
echo json_encode([
    'movies' => $movies,
    'hasMore' => $hasMore,
    'nextOffset' => $offset + count($movies),
    'count' => count($movies),
    'limit' => $limit,
    'offset' => $offset,
    'totalMatches' => $totalMatches,
    'sort' => $sort
]);
// ===== HELPER FUNCTIONS =====

/**
 * Bind the parameters shared by the page query and the COUNT(*) that follows
 * it, so the row window and the total can never disagree about what was asked
 * (a parameter added to one but not the other used to make hasMore lie).
 */
function bindListQueryParams(PDOStatement $stmt, string $searchTerm, string $category, array $favBindings, array $advancedBindings): void
{
    $stmt->bindValue(':search1', $searchTerm, PDO::PARAM_STR);
    $stmt->bindValue(':search2', $searchTerm, PDO::PARAM_STR);
    $stmt->bindValue(':search3', $searchTerm, PDO::PARAM_STR);
    $stmt->bindValue(':search4', $searchTerm, PDO::PARAM_STR);
    $stmt->bindValue(':search5', $searchTerm, PDO::PARAM_STR);
    if ($category !== '') {
        $stmt->bindValue(':category', $category, PDO::PARAM_STR);
    }
    foreach ($favBindings as $key => $val) {
        $stmt->bindValue($key, $val, PDO::PARAM_INT);
    }
    foreach ($advancedBindings as $key => $val) {
        $stmt->bindValue($key, $val, is_int($val) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
}

/**
 * Parse a free-text runtime ("2h 30m", "2h30m", "120 min", "2:30") into minutes.
 */
function parseRuntimeMinutes(string $length): int
{
    $length = trim($length);
    if ($length === '') {
        return 0;
    }

    // "2h 30m" / "2h30m" / "2 hours 30 minutes" / "2h" / "2h30"
    // The minutes part is optional: a plain "2h" used to parse as 0 minutes.
    if (preg_match('/(\d+)\s*h(?:ours?)?(?:\s*(\d+)\s*(?:m(?:in(?:utes?)?)?)?)?/i', $length, $m)) {
        return ((int)$m[1] * 60) + (isset($m[2]) ? (int)$m[2] : 0);
    }
    // "120 min" / "120min" / "120"
    if (preg_match('/^(\d+)\s*(?:min(?:utes?)?)?$/i', $length, $m)) {
        return (int)$m[1];
    }
    // "2:30" (hours:minutes)
    if (preg_match('/^(\d+):(\d+)$/', $length, $m)) {
        return ((int)$m[1] * 60) + (int)$m[2];
    }

    return 0;
}

/**
 * Total runtime of every movie in the table, in minutes.
 */
function sumRuntimeMinutes(PDO $pdo, string $table): int
{
    $stmt = $pdo->prepare("SELECT LENGTH FROM $table WHERE LENGTH IS NOT NULL AND LENGTH != ''");
    $stmt->execute();

    $total = 0;
    while ($row = $stmt->fetch()) {
        $total += parseRuntimeMinutes((string)$row['LENGTH']);
    }
    return $total;
}

/**
 * Cheap change-detector for the runtime total: one pass over two columns with
 * no row transfer and no PHP parsing. Returns null when the database cannot
 * answer at all (no CRC32, restricted access), which disables caching rather
 * than guessing.
 */
function runtimeFingerprint(PDO $pdo, string $table): ?array
{
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) AS rows_total,
                                      COALESCE(SUM(CRC32(CONCAT_WS('|', NUM, `LENGTH`))), 0) AS fingerprint
                               FROM $table
                               WHERE `LENGTH` IS NOT NULL AND `LENGTH` != ''");
        $stmt->execute();
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }
        return ['rows' => (int)$row['rows_total'], 'fingerprint' => (string)$row['fingerprint']];
    } catch (\PDOException $e) {
        return null;
    }
}

/**
 * Total runtime in minutes, cached in the temp directory and revalidated with
 * runtimeFingerprint().
 *
 * parseRuntimeMinutes() stays the source of truth, so the number never changes
 * - only the work does: the full scan plus a PHP parse per row is paid when the
 * collection actually changed, not on every stats/analytics request. A temp
 * directory that cannot be written simply falls back to computing the total.
 */
function sumRuntimeMinutesCached(PDO $pdo, string $table): int
{
    static $memo = [];
    if (isset($memo[$table])) {
        return $memo[$table];
    }

    $cacheFile = sys_get_temp_dir() . '/movielib_runtime_' . md5($table) . '.json';
    $fingerprint = runtimeFingerprint($pdo, $table);

    if ($fingerprint !== null) {
        $raw = @file_get_contents($cacheFile);
        if ($raw !== false) {
            $cached = json_decode($raw, true);
            if (is_array($cached)
                && isset($cached['minutes'])
                && (int)($cached['rows'] ?? -1) === $fingerprint['rows']
                && (string)($cached['fingerprint'] ?? '') === $fingerprint['fingerprint']) {
                return $memo[$table] = (int)$cached['minutes'];
            }
        }
    }

    $minutes = sumRuntimeMinutes($pdo, $table);
    $memo[$table] = $minutes;

    // Best effort: caching must never be able to break the endpoint.
    if ($fingerprint !== null) {
        @file_put_contents($cacheFile, json_encode([
            'rows' => $fingerprint['rows'],
            'fingerprint' => $fingerprint['fingerprint'],
            'minutes' => $minutes,
            'computedAt' => date('c'),
        ]), LOCK_EX);
    }

    return $minutes;
}

/**
 * Format minutes as "3d 4h" / "5h 30m" / "45m".
 */
function formatRuntime(int $minutes): string
{
    $hours = intdiv($minutes, 60);
    $days = intdiv($hours, 24);

    if ($days > 0) {
        return $days . 'd ' . ($hours % 24) . 'h';
    }
    if ($hours > 0) {
        return $hours . 'h ' . ($minutes % 60) . 'm';
    }
    return ($minutes % 60) . 'm';
}

/**
 * Collapse a [{year, count, avgRating}] series into per-decade totals.
 */
function buildDecadeSeries(array $byYear): array
{
    $decades = [];

    foreach ($byYear as $row) {
        $decade = (int)(floor($row['year'] / 10) * 10);
        if (!isset($decades[$decade])) {
            $decades[$decade] = ['decade' => $decade, 'count' => 0, 'ratingSum' => 0.0, 'ratingCount' => 0];
        }
        $decades[$decade]['count'] += (int)$row['count'];
        if ($row['avgRating'] !== null) {
            // Weight each year's average by its movie count
            $decades[$decade]['ratingSum'] += ((float)$row['avgRating']) * (int)$row['count'];
            $decades[$decade]['ratingCount'] += (int)$row['count'];
        }
    }

    ksort($decades);

    return array_values(array_map(function ($d) {
        return [
            'decade' => $d['decade'],
            'count' => $d['count'],
            'avgRating' => $d['ratingCount'] > 0 ? round($d['ratingSum'] / $d['ratingCount'], 1) : null
        ];
    }, $decades));
}

/**
 * Top values of one column, ignoring empty ones.
 */
function fetchTopGroups(PDO $pdo, string $table, string $column, int $limit): array
{
    $allowedColumns = ['CATEGORY', 'COUNTRY', 'DIRECTOR', 'ACTORS'];
    if (!in_array($column, $allowedColumns, true)) {
        return [];
    }

    $stmt = $pdo->prepare("SELECT `$column` AS label, COUNT(*) AS count
                           FROM $table
                           WHERE `$column` IS NOT NULL AND `$column` != ''
                           GROUP BY `$column`
                           ORDER BY count DESC, label ASC
                           LIMIT :limit");
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    return array_map(function ($row) {
        return ['label' => $row['label'], 'count' => (int)$row['count']];
    }, $stmt->fetchAll());
}

/**
 * Find the real name of one of $candidates on $table, or null when the column
 * does not exist / information_schema is not readable.
 *
 * The returned name is always one of $candidates (not whatever the database
 * reports), and it is re-validated before being interpolated into SQL, so it is
 * safe to use inside backticks.
 */
function findColumn(PDO $pdo, string $table, array $candidates): ?string
{
    $placeholders = implode(',', array_fill(0, count($candidates), '?'));
    $sql = "SELECT COLUMN_NAME FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME IN ($placeholders)";

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute(array_merge([$table], $candidates));
        $found = $stmt->fetchAll(PDO::FETCH_COLUMN);
    } catch (\PDOException $e) {
        return null;
    }

    foreach ($candidates as $candidate) {
        foreach ($found as $name) {
            if (strcasecmp($candidate, (string)$name) === 0 && preg_match('/^[A-Za-z0-9_]+$/', $candidate)) {
                return $candidate;
            }
        }
    }

    return null;
}

/**
 * Look for a column that records when a movie was added, so "growth" can mean
 * acquisition rather than release.
 */
function findDateColumn(PDO $pdo, string $table): ?string
{
    return findColumn($pdo, $table, ['DATEADDED', 'DATE_ADDED', 'ADDEDDATE', 'ADDED', 'IMPORTDATE',
                                     'IMPORT_DATE', 'CREATEDAT', 'CREATED_AT', 'CREATEDON', 'DATE_CREATED']);
}

/**
 * Resolve the table to query from the archive flag, whitelisted against
 * the configured table (never interpolate an untrusted table name).
 * Returns null when the resulting table name is not whitelisted.
 */
function resolveMovieTable(string $table, bool $useParipakva, array $allowedTables)
{
    $candidate = $useParipakva ? 'paripakva' : $table;
    return in_array($candidate, $allowedTables, true) ? $candidate : null;
}

/**
 * Escape LIKE wildcards so user input is matched literally.
 */
function escapeLike(string $value): string
{
    return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
}

/**
 * Map a DB row to the frontend movie model (used by every endpoint).
 */
function mapMovieRow(array $row, bool $useParipakva, array $posterConfig, string $noPosterFileName): array
{
    $base = $useParipakva ? $posterConfig['paripakva'] : $posterConfig['movies'];

    // ===== POSTER PATH LOGIC =====
    $posterValue = (!empty($row['PICTURENAME']) && trim($row['PICTURENAME']) !== '')
        ? $row['PICTURENAME']
        : $noPosterFileName;

    $filename = basename($posterValue);
    $imageSrc = file_exists($base['path'] . $filename)
        ? $base['url'] . $filename
        : $base['url'] . $noPosterFileName;
    // =============================

    $rating = !empty($row['USERRATING']) ? $row['USERRATING'] : ($row['RATING'] ?? null);

    // ===== EXTERNAL URL LOGIC =====
    $externalUrl = null;
    if (!empty($row['URL']) && filter_var(trim($row['URL']), FILTER_VALIDATE_URL)) {
        $externalUrl = trim($row['URL']);
    }
    // ==============================

    return [
        // NUM is the app-wide key (favorites, compare list, quick jump).
        // MySQL returns it as a string under native prepares, so cast it here
        // once - every endpoint then hands the frontend the same type, and a
        // PDO/extension change can no longer silently flip it to a string.
        'id' => (int)$row['NUM'],
        'num' => (int)$row['NUM'],  // ← Explicit NUM field for frontend
        'title' => $row['FORMATTEDTITLE'] ?? '',
        'year' => $row['YEAR'] ?? 'N/A',
        'genre' => $row['CATEGORY'] ?? 'Unknown',
        'rating' => $rating ?? '0',
        'poster' => $imageSrc,
        'description' => $row['DESCRIPTION'] ?? '',
        'certification' => $row['CERTIFICATION'] ?? '',
        'director' => $row['DIRECTOR'] ?? '',
        'actors' => $row['ACTORS'] ?? '',
        'length' => $row['LENGTH'] ?? '',
        'country' => $row['COUNTRY'] ?? '',
        'size' => $row['FILESIZE'] ?? '',
        'resolution' => $row['RESOLUTION'] ?? '',
        'audio' => $row['AUDIOFORMAT'] ?? '',
        'filepath' => $row['FILEPATH'] ?? '',
        'external_url' => $externalUrl,
        'subtitles' => $row['SUBTITLES'] ?? '',
        'source' => $useParipakva ? 'paripakva' : 'movies'
    ];
}
