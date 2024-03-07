using System.Collections.Concurrent;
using System.Text.Encodings.Web;
using MetaGenerator;
using MetaGenerator.IrdFormat;
using Microsoft.IO;
using System.Text.Json;

var baseDir = ".";
var baseDownloadUrl = "https://github.com/13xforever/ird-db/raw/main/";
var irdFileList = Directory.EnumerateFiles(".", "*.ird", new EnumerationOptions()
{
    IgnoreInaccessible = true,
    RecurseSubdirectories = true,
    MaxRecursionDepth = 2,
});

var memStreamManager = new RecyclableMemoryStreamManager();
var fileStreamOptions = new FileStreamOptions
{
    Mode = FileMode.Open,
    Access = FileAccess.Read,
    Share = FileShare.Read,
    Options = FileOptions.Asynchronous | FileOptions.SequentialScan,
    BufferSize = 16*1024,
};
#if DEBUG && !DEBUG
var maxParallel = 1;
#else
var maxParallel = Environment.ProcessorCount;
#endif

var result = new ConcurrentDictionary<string, ConcurrentDictionary<uint, IrdInfo>>();
await Parallel.ForEachAsync(irdFileList,
    new ParallelOptions{MaxDegreeOfParallelism = maxParallel},
    async (irdFilePath, ct) =>
    {
        await using var file = File.Open(irdFilePath, fileStreamOptions);
        await using var memStream = memStreamManager.GetStream();
        await file.CopyToAsync(memStream, ct).ConfigureAwait(false);
        try
        {
            var ird = IrdParser.Parse(memStream.GetBuffer());
            var relPath = Path.GetRelativePath(".", irdFilePath);
            relPath = relPath.Replace('\\', '/');
            var irdInfo = new IrdInfo(ird.Title, ird.UpdateVersion, ird.GameVersion, ird.AppVersion, relPath); 
            var irdList = result.GetOrAdd(ird.ProductCode, _ => []);
            if (!irdList.TryAdd(ird.Crc32, irdInfo))
                Log.Debug($"Skipped duplicate {irdFilePath}");
        }
        catch (Exception e)
        {
            Log.Warn(e, $"Failed to parse {irdFilePath}");
        }
    }
).ConfigureAwait(false);

var jsonWriterOptions = new JsonWriterOptions
{
    Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
#if DEBUG    
    Indented = true,
#else    
    Indented = false,
#endif
}; 

await using var output = File.Open("./pages/all.json", new FileStreamOptions
{
    Mode = FileMode.Create,
    Access = FileAccess.Write,
    Share = FileShare.Read,
    Options = FileOptions.Asynchronous | FileOptions.SequentialScan,
    PreallocationSize = 2*1024*1024,
});
await using var writer = new Utf8JsonWriter(output, jsonWriterOptions);
writer.WriteStartObject();
foreach (var (productCode, irdInfoList) in result
             .OrderBy(
                 kvp => kvp.Value.Values.First().Title
                 .Replace("[", "") // [PROTOTYPE2]
                 .Replace("]", "")
                 .Replace("(tm)", "", StringComparison.OrdinalIgnoreCase)
                 .Replace("(r)", "", StringComparison.OrdinalIgnoreCase)
                 .Replace(" ™", "")
                 .Replace("™", "")
                 .Replace(" ®", "")
                 .Replace("®", "")
                 .ReplaceFullWidth()
                 .ReplaceKana()
                 .Replace('\u2160', 'I')
                 .Replace("\u2161", "II")
                 .Replace("\u2162", "III")
                 .Replace("\u2163", "IV")
                 .Replace('\u2164', 'V')
                 .Replace('\u3000', ' ')
                 .Replace("\r\n", " ")
                 .Replace('\r', ' ')
                 .Replace('\n', ' ')
                 .Replace("    ", " ")
                 .Replace("   ", " ")
                 .Replace("  ", " ")
                 .Replace('·', '・') // greek middle dot???
                 .Replace('･', '・') // half-width
                 .Replace("CORE4", "CORE 4", StringComparison.OrdinalIgnoreCase) // game-specific 
                 .Replace("BAЛЛ•И", "ВАЛЛИ", StringComparison.OrdinalIgnoreCase) 
                 .Replace("Disgaea3", "Disgaea 3", StringComparison.OrdinalIgnoreCase) 
                 .Replace("Disgaea4", "Disgaea 4", StringComparison.OrdinalIgnoreCase) 
                 .Replace("L@ve", "Love", StringComparison.OrdinalIgnoreCase) 
                 .Replace("PROTOTYPE2", "PROTOTYPE 2", StringComparison.OrdinalIgnoreCase) 
                 .Replace("SingStar Vol.", "SingStar Vol ", StringComparison.OrdinalIgnoreCase) 
                 .Replace("skate.", "skate 1", StringComparison.OrdinalIgnoreCase) 
                 .Replace("skate2", "skate 2", StringComparison.OrdinalIgnoreCase)
                 .Replace("Spirits4", "Spirits 4", StringComparison.OrdinalIgnoreCase)
                 .Replace("FIFA09", "FIFA 09", StringComparison.OrdinalIgnoreCase)
                 .Replace("GranTurismo", "GRAN TURISMO 5 Prologue", StringComparison.OrdinalIgnoreCase) // BCKS10030
                 .Replace("GTA San Andreas", "Grand Theft Auto: San Andreas", StringComparison.OrdinalIgnoreCase)
                 .Replace("HEAVY FIRE SHATTERED SPEAR", "Heavy Fire: Shattered Spear", StringComparison.OrdinalIgnoreCase)
                 .Replace("HEAVY FIRE AFGHANISTAN", "Heavy Fire: Afghanistan", StringComparison.OrdinalIgnoreCase)
                 .Replace("Hyperdimention Neptune mk2", "Hyperdimension Neptunia mk2", StringComparison.OrdinalIgnoreCase) // BLKS20353
                 .Replace("Hyperdimension Neptune mk2", "Hyperdimension Neptunia mk2", StringComparison.OrdinalIgnoreCase) // BLJM60992
                 .Replace("Hyperdimension Neptune", "Hyperdimension Neptunia", StringComparison.OrdinalIgnoreCase)
                 .Replace("NeptuneV", "Neptune V", StringComparison.OrdinalIgnoreCase)
                 .Replace("InitialD EXTREME STAGE", "INITIAL D EXTREME STAGE", StringComparison.OrdinalIgnoreCase) // BLJM60055
                 .Replace("Modern Warfare 2", "Call of Duty: Modern Warfare 2", StringComparison.OrdinalIgnoreCase)
                 .Replace("MotoGP08", "MotoGP 08", StringComparison.OrdinalIgnoreCase)
                 .Replace("Yoostar2", "Yoostar 2", StringComparison.OrdinalIgnoreCase)
                 .Replace("RuneFactoryOceans", "Rune Factory Oceans", StringComparison.OrdinalIgnoreCase)
                 .Replace("Persona4", "Persona 4", StringComparison.OrdinalIgnoreCase)
                 .Replace("NBA2K7", "NBA 2K7", StringComparison.OrdinalIgnoreCase)
                 .Trim(), // extra whitespaces
                 StringComparer.OrdinalIgnoreCase
             ).ThenBy(kvp => kvp.Key))
{
    writer.WriteStartArray(productCode);
    foreach (var (crc, irdInfo) in irdInfoList
                 .OrderBy(ii => ii.Value.GameVer)
                 .ThenBy(ii => ii.Value.AppVer))
    {
        writer.WriteStartObject();
        writer.WriteString("title", irdInfo.Title);
        if (irdInfo.FwVer is {Length: >0} fwVer and not "\0\0\0\0")
            writer.WriteString("fw-ver", fwVer);
        if (irdInfo.GameVer is {Length: >0} gameVer and not "\0\0\0\0\0")
            writer.WriteString("game-ver", gameVer);
        if (irdInfo.AppVer is {Length: >0} appVer and not "\0\0\0\0\0")
            writer.WriteString("app-ver", appVer);
#if DEBUG
        writer.WriteString("ird-crc32", crc.ToString("x8"));
#endif
        writer.WriteString("link", irdInfo.DownloadLink);
        writer.WriteEndObject();
    }
    writer.WriteEndArray();
}
writer.WriteEndObject();
await writer.FlushAsync().ConfigureAwait(false);
await output.FlushAsync().ConfigureAwait(false);
Log.Info("Done.");
