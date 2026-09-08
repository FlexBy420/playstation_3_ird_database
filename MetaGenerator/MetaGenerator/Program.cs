using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Globalization;
using System.Text.RegularExpressions;
using System.Linq;
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
    BufferSize = 16 * 1024,
};
#if DEBUG && !DEBUG
var maxParallel = 1;
#else
var maxParallel = Environment.ProcessorCount;
#endif

string ReplaceDisplayedTitle(string productCode, string title)
{
    if (ProductTitleMapping.Mapping.ContainsKey(productCode))
    {
        return ProductTitleMapping.Mapping[productCode];
    }
    return title;
}

var result = new ConcurrentDictionary<string, ConcurrentDictionary<uint, IrdInfo>>();
await Parallel.ForEachAsync(irdFileList,
    new ParallelOptions { MaxDegreeOfParallelism = maxParallel },
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

            var irdInfo = new IrdInfo(
                ReplaceDisplayedTitle(ird.ProductCode, ird.Title),
                ird.UpdateVersion,
                ird.GameVersion,
                ird.AppVersion,
                ird.FileCount,
                relPath,
                ird.DiscSize
            );

            var irdList = result.GetOrAdd(ird.ProductCode, _ => new ConcurrentDictionary<uint, IrdInfo>());
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
    PreallocationSize = 2 * 1024 * 1024,
});
await using var writer = new Utf8JsonWriter(output, jsonWriterOptions);
writer.WriteStartObject();
foreach (var (productCode, irdInfoList) in result
    .OrderBy(kvp => kvp.Value.Values.First().Title, StringComparer.OrdinalIgnoreCase)
    .ThenBy(kvp => kvp.Key, StringComparer.OrdinalIgnoreCase)
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
            .Replace('･', '・') // half-fwidth
            .Replace("skate.", "skate 1", StringComparison.OrdinalIgnoreCase)
            .Replace("SingStar Vol.", "SingStar Vol ", StringComparison.OrdinalIgnoreCase)
            .Replace("PROTOTYPE2", "PROTOTYPE 2", StringComparison.OrdinalIgnoreCase)
            .Replace("L@ve", "Love", StringComparison.OrdinalIgnoreCase)
            .Replace("BAЛЛ•И", "ВАЛЛИ", StringComparison.OrdinalIgnoreCase)
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
        writer.WriteString("title", string.Join(", ", irdInfo.Title));
        if (irdInfo.FwVer is { Length: > 0 } fwVer and not "\0\0\0\0")
            writer.WriteString("fw-ver", fwVer);
        if (irdInfo.GameVer is { Length: > 0 } gameVer and not "\0\0\0\0\0")
            writer.WriteString("game-ver", gameVer);
        if (irdInfo.AppVer is { Length: > 0 } appVer and not "\0\0\0\0\0")
            writer.WriteString("app-ver", appVer);
            writer.WriteNumber("file-count", irdInfo.FileCount);
            writer.WriteNumber("disc-size", irdInfo.DiscSize);
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

var dkeyDir = Path.Combine(baseDir, "dkeys");
if (Directory.Exists(dkeyDir))
{
    var dkeyZipPath = Directory.EnumerateFiles(dkeyDir, "*.zip", SearchOption.TopDirectoryOnly)
        .OrderByDescending(GetDkeyArchiveDate)
        .FirstOrDefault();

    if (dkeyZipPath is not null)
    {
        var dkeys = new SortedDictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        using (var archive = ZipFile.OpenRead(dkeyZipPath))
        {
            foreach (var entry in archive.Entries)
            {
                if (string.IsNullOrEmpty(entry.Name) ||
                    !entry.Name.EndsWith(".key", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                await using var keyStream = entry.Open();
                using var keyBuffer = new MemoryStream();
                await keyStream.CopyToAsync(keyBuffer).ConfigureAwait(false);
                var key = keyBuffer.ToArray();

                if (key.Length != 16)
                {
                    Log.Warn($"Skipped DKEY with invalid size ({key.Length} bytes): {entry.FullName}");
                    continue;
                }

                var keyName = Path.GetFileNameWithoutExtension(entry.Name);
                if (!dkeys.TryAdd(keyName, Convert.ToHexString(key).ToLowerInvariant()))
                {
                    Log.Warn($"Skipped duplicate DKEY name: {keyName}");
                }
            }
        }

        var archiveDate = GetDkeyArchiveDate(dkeyZipPath);
        await using (var dkeyOutput = File.Open("./pages/dkey.json", new FileStreamOptions
        {
            Mode = FileMode.Create,
            Access = FileAccess.Write,
            Share = FileShare.Read,
            Options = FileOptions.Asynchronous | FileOptions.SequentialScan,
            PreallocationSize = 512 * 1024,
        }))
        await using (var dkeyWriter = new Utf8JsonWriter(dkeyOutput, jsonWriterOptions))
        {
            dkeyWriter.WriteStartObject();
            dkeyWriter.WriteString("date", archiveDate.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture));
            dkeyWriter.WriteNumber("count", dkeys.Count);
            dkeyWriter.WriteStartObject("keys");
            foreach (var (name, key) in dkeys)
            {
                dkeyWriter.WriteString(name, key);
            }
            dkeyWriter.WriteEndObject();
            dkeyWriter.WriteEndObject();
            await dkeyWriter.FlushAsync().ConfigureAwait(false);
            await dkeyOutput.FlushAsync().ConfigureAwait(false);
        }

        File.Copy(dkeyZipPath, "./pages/dkeys.zip", overwrite: true);
        Log.Info($"Generated DKEY database with {dkeys.Count} keys from {Path.GetFileName(dkeyZipPath)}.");
    }
    else
    {
        Log.Warn("No DKEY zip archive found in ./dkeys.");
    }
}
else
{
    Log.Warn("DKEY directory ./dkeys does not exist.");
}

Log.Info("Done.");

static DateTime GetDkeyArchiveDate(string path)
{
    var fileName = Path.GetFileName(path);
    var match = Regex.Match(
        fileName,
        @"\((\d{4}-\d{2}-\d{2}) (\d{2})-(\d{2})-(\d{2})\)\.zip$",
        RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);

    if (match.Success && DateTime.TryParseExact(
        $"{match.Groups[1].Value} {match.Groups[2].Value}:{match.Groups[3].Value}:{match.Groups[4].Value}",
        "yyyy-MM-dd HH:mm:ss",
        CultureInfo.InvariantCulture,
        DateTimeStyles.None,
        out var archiveDate))
    {
        return archiveDate;
    }

    return File.GetLastWriteTime(path);
}