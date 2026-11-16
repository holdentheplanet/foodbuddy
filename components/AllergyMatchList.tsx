import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { LocalAllergyMatch, LocalAllergyResult } from '../services/localAllergyMatching';
import { colors } from '../ui/theme';

type Section = {
  key: string;
  title: string;
  hint: string;
  color: string;
  matches: LocalAllergyMatch[];
};

// Most serious first. A "Small amounts" setting moves a term to its own
// section no matter where it was found.
function buildSections(matches: LocalAllergyMatch[]): Section[] {
  const limited = matches.filter(m => m.tolerance === 'limit');
  const rest = matches.filter(m => m.tolerance !== 'limit');

  const sections: Section[] = [
    {
      key: 'contains',
      title: 'CONTAINS',
      hint: 'On the label or in the manufacturer’s allergen statement.',
      color: colors.red,
      matches: rest.filter(m => m.source !== 'traces' && m.kind !== 'possible_derivative'),
    },
    {
      key: 'traces',
      title: 'MAY CONTAIN',
      hint: 'Precautionary / cross-contact warning.',
      color: colors.amber,
      matches: rest.filter(m => m.source === 'traces'),
    },
    {
      key: 'possible',
      title: 'POSSIBLE',
      hint: 'Often made from this allergen. The label doesn’t say the source.',
      color: colors.amber,
      matches: rest.filter(m => m.source !== 'traces' && m.kind === 'possible_derivative'),
    },
    {
      key: 'limit',
      title: 'SMALL AMOUNTS — YOUR SETTING',
      hint: 'You allow small amounts of these.',
      color: colors.muted,
      matches: limited,
    },
  ];

  return sections.filter(section => section.matches.length > 0);
}

// Catalog notes are sentence endings ("is usually made from corn"), so they
// read after the term. A note that already starts with a capital stands alone.
function noteText(term: string, note: string): string {
  if (/^[A-Z]/.test(note)) return note;
  return `${term.charAt(0).toUpperCase()}${term.slice(1)} ${note}`;
}

// One muted line by default; tap to read the whole note.
function MatchNote({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      onPress={() => setExpanded(value => !value)}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint={expanded ? 'Collapses the note' : 'Shows the full note'}
    >
      <Text style={styles.note} numberOfLines={expanded ? undefined : 1}>
        ⓘ {text}
      </Text>
    </TouchableOpacity>
  );
}

export default function AllergyMatchList({ result }: { result: LocalAllergyResult }) {
  const sections = buildSections(result.matches);
  const allowed = result.allowedBySettings ?? [];

  return (
    <View>
      {sections.map(section => {
        // The same term can be found twice (e.g. label and statement); show it once.
        const seen = new Set<string>();
        const rows = section.matches.filter(match => {
          const key = `${match.allergen}|${match.matchedIngredient.toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        return (
          <View key={section.key} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: section.color }]}>
              {section.title}
            </Text>
            <Text style={styles.sectionHint}>{section.hint}</Text>

            {rows.map(match => (
              <View
                key={`${match.allergen}-${match.matchedIngredient}-${match.source}`}
                style={[styles.row, { borderLeftColor: section.color }]}
              >
                <Text style={styles.rowText}>
                  {match.allergen} · {match.matchedIngredient}
                  {match.kind === 'declared' ? (
                    <Text style={styles.rowTag}>  (allergen statement)</Text>
                  ) : null}
                </Text>
                {match.note ? (
                  <MatchNote text={noteText(match.matchedIngredient, match.note)} />
                ) : null}
              </View>
            ))}
          </View>
        );
      })}

      {allowed.length > 0 && (
        <Text style={styles.allowed}>
          Not flagged because of your settings:{' '}
          {allowed.map(a => `${a.term} (${a.allergen})`).join(', ')}. You can
          change this on your Allergies tab.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: 1,
    borderTopColor: '#DADADA',
    marginTop: 12,
    paddingTop: 10,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  sectionHint: {
    color: '#53645F',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  row: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  rowText: {
    color: colors.blue,
    fontWeight: 'bold',
    fontSize: 14,
  },
  rowTag: {
    color: '#53645F',
    fontWeight: 'normal',
    fontSize: 12,
  },
  note: {
    color: '#53645F',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
    marginTop: 2,
  },
  allowed: {
    color: '#53645F',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
});
