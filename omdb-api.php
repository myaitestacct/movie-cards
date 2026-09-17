<?php
// omdb-api.php - OMDB API Integration for fetching movie posters

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");

// ===== LOAD DATABASE CONFIGURATION =====
$config = require __DIR__ . '/config.php';

$host = $config['host'];
$db   = $config['db'];
$user = $config['user'];
$pass = $config['pass'];
$charset = $config['charset'];
$table = $config['table'];

// ===== OMDB API CONFIGURATION =====
// Free API key from https://www.omdbapi.com/apikey.aspx
$omdbApiKey = 'YOUR_OMDB_API_KEY_HERE'; // Replace with your actual API key
$omdbApiUrl = 'https://www.omdbapi.com/';
// ====================================

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

// ===== HANDLE REQUEST =====
$action = isset($_GET['action']) ? trim($_GET['action']) : '';

// Fetch poster for a single movie
if ($action === 'fetch_poster') {
    $movieNum = isset($_GET['num']) ? (int)$_GET['num'] : 0;
    
    if ($movieNum <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid movie number']);
        exit;
    }
    
    try {
        // Get movie title from database
        $stmt = $pdo->prepare("SELECT FORMATTEDTITLE FROM $table WHERE NUM = :num");
        $stmt->bindValue(':num', $movieNum, PDO::PARAM_INT);
        $stmt->execute();
        $movie = $stmt->fetch();
        
        if (!$movie) {
            http_response_code(404);
            echo json_encode(['error' => 'Movie not found']);
            exit;
        }
        
        $title = $movie['FORMATTEDTITLE'];
        
        // Fetch from OMDB API
        $omdbResponse = fetchFromOMDB($title, $omdbApiKey, $omdbApiUrl);
        
        if (!$omdbResponse || !isset($omdbResponse['Poster']) || $omdbResponse['Poster'] === 'N/A') {
            echo json_encode(['success' => false, 'message' => 'No poster found in OMDB']);
            exit;
        }
        
        $posterUrl = $omdbResponse['Poster'];
        
        // Update database with new poster URL
        $updateStmt = $pdo->prepare("UPDATE $table SET PICTURENAME = :poster WHERE NUM = :num");
        $updateStmt->bindValue(':poster', $posterUrl, PDO::PARAM_STR);
        $updateStmt->bindValue(':num', $movieNum, PDO::PARAM_INT);
        $updateStmt->execute();
        
        echo json_encode([
            'success' => true,
            'message' => 'Poster updated successfully',
            'poster' => $posterUrl
        ]);
        
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error']);
    }
    exit;
}

// Bulk fetch posters for movies with missing posters
if ($action === 'bulk_fetch_posters') {
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
    $limit = min($limit, 100); // Cap at 100
    
    try {
        // Get movies with missing or default posters
        $stmt = $pdo->prepare("SELECT NUM, FORMATTEDTITLE FROM $table WHERE PICTURENAME IS NULL OR PICTURENAME = '' OR PICTURENAME LIKE '%coming_soon%' LIMIT :limit");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $movies = $stmt->fetchAll();
        
        $results = [];
        $successCount = 0;
        $failCount = 0;
        
        foreach ($movies as $movie) {
            $title = $movie['FORMATTEDTITLE'];
            $num = $movie['NUM'];
            
            // Fetch from OMDB API
            $omdbResponse = fetchFromOMDB($title, $omdbApiKey, $omdbApiUrl);
            
            if ($omdbResponse && isset($omdbResponse['Poster']) && $omdbResponse['Poster'] !== 'N/A') {
                $posterUrl = $omdbResponse['Poster'];
                
                // Update database
                $updateStmt = $pdo->prepare("UPDATE $table SET PICTURENAME = :poster WHERE NUM = :num");
                $updateStmt->bindValue(':poster', $posterUrl, PDO::PARAM_STR);
                $updateStmt->bindValue(':num', $num, PDO::PARAM_INT);
                $updateStmt->execute();
                
                $results[] = [
                    'num' => $num,
                    'title' => $title,
                    'success' => true,
                    'poster' => $posterUrl
                ];
                $successCount++;
            } else {
                $results[] = [
                    'num' => $num,
                    'title' => $title,
                    'success' => false,
                    'message' => 'No poster found'
                ];
                $failCount++;
            }
            
            // Small delay to avoid rate limiting
            usleep(200000); // 0.2 seconds
        }
        
        echo json_encode([
            'success' => true,
            'processed' => count($movies),
            'successCount' => $successCount,
            'failCount' => $failCount,
            'results' => $results
        ]);
        
    } catch (\PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error']);
    }
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Invalid action']);

// ===== HELPER FUNCTIONS =====

function fetchFromOMDB($title, $apiKey, $apiUrl) {
    $params = [
        'apikey' => $apiKey,
        't' => $title,
        'type' => 'movie'
    ];
    
    $url = $apiUrl . '?' . http_build_query($params);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200 || !$response) {
        return null;
    }
    
    $data = json_decode($response, true);
    
    if (!$data || isset($data['Error'])) {
        return null;
    }
    
    return $data;
}