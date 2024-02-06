namespace MetaGenerator;

public static class Char
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

    public static string ReplaceKana(this string str)
    {
        var result = new StringBuilder();
        foreach (var ch in str)
        {
            if (ch is >= '\u30a1' and <= '\u30f6')
                result.Append((char)(ch - '\u30a0' + '\u3040'));
            else
                result.Append(ch);
        }
        return result.ToString();
    }
}