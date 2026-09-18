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

// ===== MOVIE COLUMNS (shared by every SELECT below) =====
$movieColumns = 'NUM, FORMATTEDTITLE, YEAR, CATEGORY, RATING, USERRATING, DESCRIPTION, '
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

        // Total runtime (calculate from LENGTH field)
        $runtimeStmt = $pdo->prepare("SELECT LENGTH FROM $tableToQuery WHERE LENGTH IS NOT NULL AND LENGTH != ''");
        $runtimeStmt->execute();
        $totalMinutes = 0;
        while ($row = $runtimeStmt->fetch()) {
            $length = trim($row['LENGTH']);
            if (empty($length)) continue;
            
            // Parse various formats: "2h 30m", "2h30m", "120 min", "120min", "2:30"
            $minutes = 0;
            
            // Format: "2h 30m" or "2h30m"
            if (preg_match('/(\d+)\s*h(?:ours?)?\s*(\d+)?\s*m(?:in(?:utes?)?)?/i', $length, $matches)) {
                $hours = (int)$matches[1];
                $mins = isset($matches[2]) ? (int)$matches[2] : 0;
                $minutes = ($hours * 60) + $mins;
            }
            // Format: "120 min" or "120min" or just "120"
            elseif (preg_match('/^(\d+)\s*(?:min(?:utes?)?)?$/i', $length, $matches)) {
                $minutes = (int)$matches[1];
            }
            // Format: "2:30" (hours:minutes)
            elseif (preg_match('/^(\d+):(\d+)$/', $length, $matches)) {
                $hours = (int)$matches[1];
                $mins = (int)$matches[2];
                $minutes = ($hours * 60) + $mins;
            }
            
            $totalMinutes += $minutes;
        }
        
        // Format total runtime nicely
        $totalHours = floor($totalMinutes / 60);
        $remainingMinutes = $totalMinutes % 60;
        $totalDays = floor($totalHours / 24);
        $remainingHours = $totalHours % 24;
        
        $totalRuntimeFormatted = '';
        if ($totalDays > 0) {
            $totalRuntimeFormatted = "{$totalDays}d {$remainingHours}h";
        } elseif ($totalHours > 0) {
            $totalRuntimeFormatted = "{$totalHours}h {$remainingMinutes}m";
        } else {
            $totalRuntimeFormatted = "{$remainingMinutes}m";
        }

        echo json_encode([
            'totalMovies' => (int)$totalMovies,
            'avgRating' => $avgRating,
            'topGenre' => $topGenre,
            'topGenreCount' => (int)$topGenreCount,
            'totalRuntime' => $totalRuntimeFormatted,
            'totalRuntimeMinutes' => $totalMinutes
        ]);
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch stats']);
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

// Parse comma-separated values
$resolutions = $resolutionsParam ? array_filter(array_map('trim', explode(',', $resolutionsParam))) : [];
$audioFormats = $audioParam ? array_filter(array_map('trim', explode(',', $audioParam))) : [];
$certifications = $certificationsParam ? array_filter(array_map('trim', explode(',', $certificationsParam))) : [];

// Cap limit to prevent abuse
$limit = min($limit, 100);
if ($limit < 1) $limit = 50;
if ($offset < 0) $offset = 0;

// Sanitize search query (strip null bytes, limit length)
$query = str_replace("\0", '', $query);
$query = mb_substr($query, 0, 200);

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
    $advancedBindings[':country'] = "%{$countryParam}%";
}
if ($directorParam !== '') {
    $conditions[] = "DIRECTOR LIKE :director";
    $advancedBindings[':director'] = "%{$directorParam}%";
}
if ($actorsParam !== '') {
    $conditions[] = "ACTORS LIKE :actors";
    $advancedBindings[':actors'] = "%{$actorsParam}%";
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
    $searchTerm = "%$query%";
    
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
    $countStmt->bindValue(':search1', $searchTerm, PDO::PARAM_STR);
    $countStmt->bindValue(':search2', $searchTerm, PDO::PARAM_STR);
    $countStmt->bindValue(':search3', $searchTerm, PDO::PARAM_STR);
    $countStmt->bindValue(':search4', $searchTerm, PDO::PARAM_STR);
    $countStmt->bindValue(':search5', $searchTerm, PDO::PARAM_STR);
    if ($category !== '') {
        $countStmt->bindValue(':category', $category, PDO::PARAM_STR);
    }
    foreach ($favBindings as $key => $val) {
        $countStmt->bindValue($key, $val, PDO::PARAM_INT);
    }
    foreach ($advancedBindings as $key => $val) {
        $countStmt->bindValue($key, $val, is_int($val) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
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
        'id' => $row['NUM'],
        'num' => $row['NUM'],  // ← Explicit NUM field for frontend
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
        'source' => $useParipakva ? 'paripakva' : 'movies'
    ];
}
