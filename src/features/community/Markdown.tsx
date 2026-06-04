import React from "react";
import { View, Text, StyleSheet, TextStyle } from "react-native";
import type { useThemeColors } from "@/constants/colors";

type ThemeColors = ReturnType<typeof useThemeColors>;

// Inline parsing: **bold**, *italic*, `code`, [text](url)
type Segment = { text: string; style?: TextStyle };

function parseInline(line: string, colors: ThemeColors): Segment[] {
  const segments: Segment[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: line.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith("**") && raw.endsWith("**")) {
      segments.push({
        text: raw.slice(2, -2),
        style: { fontFamily: "Inter_700Bold" },
      });
    } else if (raw.startsWith("`") && raw.endsWith("`")) {
      segments.push({
        text: raw.slice(1, -1),
        style: {
          fontFamily: "Inter_500Medium",
          backgroundColor: colors.inputBg,
          color: colors.text,
        },
      });
    } else if (raw.startsWith("[") && raw.includes("](")) {
      const closeBracket = raw.indexOf("](");
      const text = raw.slice(1, closeBracket);
      segments.push({
        text,
        style: { color: colors.primary, textDecorationLine: "underline" },
      });
    } else if (raw.startsWith("*") && raw.endsWith("*")) {
      segments.push({ text: raw.slice(1, -1), style: { fontStyle: "italic" } });
    } else {
      segments.push({ text: raw });
    }
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex) });
  }
  if (segments.length === 0) segments.push({ text: line });
  return segments;
}

function renderInline(line: string, colors: ThemeColors, baseStyle: TextStyle) {
  return parseInline(line, colors).map((s, i) => (
    <Text key={i} style={[baseStyle, s.style]}>
      {s.text}
    </Text>
  ));
}

export function Markdown({
  source,
  colors,
  textColor,
}: {
  source: string;
  colors: ThemeColors;
  textColor?: string;
}) {
  const baseColor = textColor || colors.text;
  // Split into blocks by blank line
  const blocks = source.split(/\n\s*\n/);

  return (
    <View>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const first = lines[0]?.trimStart() || "";

        // Heading
        const headingMatch = first.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const text = headingMatch[2];
          const headingStyles: TextStyle[] = [
            { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 8 },
            { fontSize: 19, fontFamily: "Inter_700Bold", marginBottom: 7 },
            { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 6 },
            { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 5 },
            { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 5 },
            { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
          ];
          return (
            <Text key={bi} style={[{ color: baseColor }, headingStyles[level - 1]]}>
              {renderInline(text, colors, { color: baseColor })}
            </Text>
          );
        }

        // Bullet list block
        const isBulletBlock = lines.every((l) => /^\s*[-*]\s+/.test(l));
        if (isBulletBlock && lines.length > 0) {
          return (
            <View key={bi} style={styles.listBlock}>
              {lines.map((l, li) => {
                const m = l.match(/^\s*[-*]\s+(.+)$/);
                if (!m) return null;
                return (
                  <View key={li} style={styles.listRow}>
                    <Text style={[styles.bullet, { color: baseColor }]}>•</Text>
                    <Text style={[styles.listItem, { color: baseColor }]}>
                      {renderInline(m[1], colors, { color: baseColor })}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        }

        // Quote
        if (first.startsWith("> ")) {
          const quoteText = lines.map((l) => l.replace(/^>\s?/, "")).join("\n");
          return (
            <View
              key={bi}
              style={[
                styles.quote,
                { borderLeftColor: colors.primary, backgroundColor: colors.inputBg },
              ]}
            >
              <Text style={[styles.quoteText, { color: colors.textSecondary }]}>
                {renderInline(quoteText, colors, { color: colors.textSecondary })}
              </Text>
            </View>
          );
        }

        // Paragraph (preserve line breaks inside as <br>)
        return (
          <Text key={bi} style={[styles.para, { color: baseColor }]}>
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && "\n"}
                {renderInline(line, colors, { color: baseColor })}
              </React.Fragment>
            ))}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  para: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
    marginBottom: 12,
  },
  listBlock: { marginBottom: 12 },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 4 },
  bullet: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    lineHeight: 24,
    marginTop: -1,
  },
  listItem: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 23,
  },
  quote: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 8,
    paddingRight: 12,
    marginBottom: 12,
    borderRadius: 4,
  },
  quoteText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    fontStyle: "italic",
    lineHeight: 22,
  },
});
