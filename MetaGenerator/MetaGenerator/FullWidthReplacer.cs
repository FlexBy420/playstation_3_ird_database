namespace MetaGenerator;

public static class FullWidthReplacer
{
    public static string ReplaceFullWidth(this string str)
    {
        var result = new StringBuilder();
        foreach (var ch in str)
        {
            if (ch is >= '\uff01' and <= '\uff5e') // ! to ~
                result.Append((char)(ch - '\uff00' + ' '));
            else
                result.Append(ch);
        }
        return result.ToString();
    }
}