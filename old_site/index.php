<?php
$selectedFolder = isset($_GET['folder']) ? $_GET['folder'] : 'redump';
function parseIRDFile($filePath) {
    try {
        // Check if the file is gzipped
        $isGzipped = function_exists('gzdecode') && isGzipped($filePath);

        // Read the content of the file
        $content = $isGzipped ? gzdecode(file_get_contents($filePath)) : file_get_contents($filePath);

        // Check if the content starts with the '3IRD' magic string
        if (strpos($content, '3IRD') !== 0) {
            throw new Exception("Not a valid IRD file");
        }

        // Extract information using substrings
      //  $version = ord($content[4]);
        $productCode = rtrim(substr($content, 5, 9), "\x00");
        $titleLength = ord($content[14]);
        $title = rtrim(substr($content, 15, $titleLength), "\x00");
        $ps3SystemVersion = rtrim(substr($content, 15 + $titleLength, 5), "\x00");
        $versionStr = rtrim(substr($content, 20 + $titleLength, 5), "\x00");
     //   $appVersion = rtrim(substr($content, 25 + $titleLength, 5), "\x00");

        // Format functions
       // $formatVersion = function ($version) {
       //     return (string) $version;
       // };

        $formatSystemVersion = function ($systemVersion) {
            return rtrim($systemVersion, '0');
        };

        $formatVersionString = function ($versionStr) {
            $segments = explode('.', $versionStr);
            return count($segments) === 2 ? sprintf('%02d.%02d', $segments[0], substr($segments[1], 0, 2)) : '00.00';
        };

        return [
           // 'IRDVersion' => $formatVersion($version),
            'ProductCode' => $productCode,
            'Title' => $title,
            'PS3SystemVersion' => $formatSystemVersion($ps3SystemVersion),
            'GameVersion' => $formatVersionString($versionStr),
          //  'AppVersion' => $formatVersionString($appVersion),
        ];
    } catch (Exception $e) {
        echo "Error parsing IRD file $filePath: " . $e->getMessage() . "\n";
        return null;
    }
}

function isGzipped($filePath) {
    $signature = file_get_contents($filePath, false, null, 0, 2);
    return bin2hex($signature) === '1f8b';
}

$irdDirectory = __DIR__ . DIRECTORY_SEPARATOR . $selectedFolder;
$irdFiles = glob($irdDirectory . '/*.ird');
$totalIRDs = count($irdFiles);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <title>PS3 IRD Database</title>
    <link rel="icon" href="favicon.png">
    <style>
body{font-family:Arial,sans-serif;background-color:#f4f4f4;margin:0;padding:0}a{text-decoration:none;color:#ccc}a:hover{color:yellow;font-weight:bold}h1,h6{background-color:#333;color:#fff;padding:10px;margin:0;          text-align:center}h4{background-color:#333;color:#fff;margin:0;text-align:center}table{width:100%;border-collapse:collapse;margin-top:10px;background-color:#fff;box-shadow:0 0 10px rgba(0,0,0,.1)}th,td{border:1px solid #ddd;text-align:left;padding:10px}th{cursor:pointer;user-select:none;background-color:#4CAF50;color:#fff}.ird_h{width:30px}.dl_cell{width:50px;text-align:center}.image{width:20px;height:20px;cursor:pointer}.SearchBar{padding:10px;font-size:16px;margin-bottom:-11px;width:100%;box-sizing:border-box}#tools{font-size:16px;margin:0;background-color:#333;padding:10px;text-align:center}
    </style>
</head>
<body>
    <h1><a href="https://www.psx-place.com/threads/3k3y-iso-tools-understanding-ps3-disk-encryption.29903/">IRD DATABASE</a></h1>
    <h4>Total IRDs: <?php echo $totalIRDs; ?></h4>
    <div id="tools">
        <a href="http://redump.org/discs/system/ps3/">Redump</a>
        • <a href="https://github.com/Zarh/ird_tools/releases">ird tools</a>
        • <a href="https://archive.org/details/IsoToolsV1.34.9.7z">3k3y-iso-tools</a>
        • <a href="https://archive.org/details/ps3-iso-rebuilder-1.0.4.1">ps3-iso-rebuilder</a>
        • <a href="http://forum.redump.org/topic/14035/various-ps3-tools/">Redump2ird</a>
        • <a href="https://github.com/13xforever/ps3-disc-dumper">PS3 Disc Dumper</a>
        • <a href="https://ps3.aldostools.org/dkey.html">aldostools DKEY database</a>
        • <a href="https://ps3.aldostools.org/ird.html">aldostools IRD database</a>
        • <a href="http://ps3ird.free.fr/">Zar's IRD database</a>
    </div>
    <h6>Made by <a href="https://github.com/FlexBy420">FlexBy</a></h6>

<input class="SearchBar" id="txtSrchDB" onkeyup="doSearch()" type="text" placeholder="Search...">

<table id="dbTable">
    <tr>
        <th class="ird_h">IRD</th>
        <th onclick="sortTable(1)" style="width:100px">ID</th>
        <th onclick="sortTable(2)">Title</th>
        <th onclick="sortTable(3)" style="width:60px">Version</th>
        <th onclick="sortTable(4)" style="width:60px">Update</th>
    </tr>

<?php
foreach ($irdFiles as $irdFile) {
    $irdInfo = parseIRDFile($irdFile);
    if ($irdInfo !== null) {
        echo '<tr>';
        echo '<td class="dl_cell"><a href="download.php?file=' . urlencode($selectedFolder . '/' . basename($irdFile)) . '" download><input class="image" type="image" src="download.svg"></a></td>';
        echo '<td>' . $irdInfo['ProductCode'] . '</td>';
        echo '<td>' . $irdInfo['Title'] . '</td>';
        echo '<td>' . $irdInfo['GameVersion'] . '</td>';
        echo '<td>' . $irdInfo['PS3SystemVersion'] . '</td>';
        echo '</tr>';
       # var_dump($irdInfo);  // Add this line for debugging
    }
}
?>
</table>
<script type="text/javascript" src="SearchSort.js"></script>
</body>
</html>