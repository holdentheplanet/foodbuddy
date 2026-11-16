import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  addCustomDerivative,
  removeCustomDerivative,
  setDerivativeTolerance,
  type CustomMatchType,
  type Derivative,
  type Tolerance,
} from '../database/allergyCatalog';
import { colors } from '../ui/theme';

type Props = {
  userId: number;
  allergen: { id: number; name: string };
  derivatives: Derivative[];
  busy: boolean;
  onRemoveAllergy: () => void;
  // Reload this allergy's terms after one is added or removed.
  onDerivativesChanged: () => Promise<void>;
};

const TOLERANCE_OPTIONS: { value: Tolerance; label: string }[] = [
  { value: 'avoid', label: 'Avoid' },
  { value: 'limit', label: 'Small amounts' },
  { value: 'ok', label: 'OK for me' },
];

const TOLERANCE_COLORS: Record<Tolerance, string> = {
  avoid: colors.red,
  limit: colors.amber,
  ok: colors.green,
};

// Collapsed cards show this many terms, plus any the user has changed or added.
const COLLAPSED_LIMIT = 5;

// Catalog notes are sentence endings ("is usually made from corn"), so they
// read after the term. A note that already starts with a capital stands alone.
function noteText(term: string, note: string): string {
  if (/^[A-Z]/.test(note)) return note;
  return `${term.charAt(0).toUpperCase()}${term.slice(1)} ${note}`;
}

export default function AllergyCard({
  userId,
  allergen,
  derivatives,
  busy,
  onRemoveAllergy,
  onDerivativesChanged,
}: Props) {
  // Local copy so a tolerance tap shows immediately, before the save finishes.
  const [items, setItems] = useState<Derivative[]>(derivatives);
  const [expanded, setExpanded] = useState(false);
  const [newTerm, setNewTerm] = useState('');
  const [newType, setNewType] = useState<CustomMatchType>('definite');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setItems(derivatives);
  }, [derivatives]);

  // Exclude terms are never flagged, so there's nothing for the user to set.
  const flaggable = items.filter(item => item.matchType !== 'exclude');
  const isChanged = (item: Derivative) =>
    item.isCustom || item.tolerance !== 'avoid';

  let visible = flaggable;
  if (!expanded && flaggable.length > COLLAPSED_LIMIT) {
    const shown = new Set(
      flaggable.slice(0, COLLAPSED_LIMIT).map(item => item.id)
    );
    visible = flaggable.filter(item => shown.has(item.id) || isChanged(item));
  }
  const hiddenCount = flaggable.length - visible.length;

  const definite = visible.filter(item => item.matchType === 'definite');
  const possible = visible.filter(item => item.matchType === 'possible');

  const okCount = flaggable.filter(item => item.tolerance === 'ok').length;
  const limitCount = flaggable.filter(item => item.tolerance === 'limit').length;

  async function changeTolerance(item: Derivative, tolerance: Tolerance) {
    if (item.tolerance === tolerance) return;

    const previous = items;
    setItems(current =>
      current.map(entry =>
        entry.id === item.id ? { ...entry, tolerance } : entry
      )
    );

    try {
      await setDerivativeTolerance(userId, item.id, tolerance);
    } catch (error) {
      console.error(error);
      setItems(previous);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not save this setting.'
      );
    }
  }

  async function addTerm() {
    if (!newTerm.trim() || saving) return;

    setSaving(true);
    try {
      await addCustomDerivative(userId, allergen.id, newTerm, newType);
      setNewTerm('');
      setNewType('definite');
      await onDerivativesChanged();
    } catch (error) {
      console.error(error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not add this ingredient.'
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmRemoveTerm(item: Derivative) {
    Alert.alert(
      'Remove ingredient?',
      `Remove "${item.term}" from ${allergen.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeCustomDerivative(userId, item.id);
              await onDerivativesChanged();
            } catch (error) {
              console.error(error);
              Alert.alert(
                'Error',
                error instanceof Error
                  ? error.message
                  : 'Could not remove this ingredient.'
              );
            }
          },
        },
      ]
    );
  }

  function renderTerm(item: Derivative) {
    return (
      <View key={item.id} style={styles.termRow}>
        <View style={styles.termHeader}>
          <Text style={styles.termName}>{item.term}</Text>

          {item.isCustom && (
            <Text style={styles.customBadge}>CUSTOM</Text>
          )}

          {item.isCustom && (
            <TouchableOpacity
              onPress={() => confirmRemoveTerm(item)}
              disabled={busy || saving}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.term}`}
              style={styles.termRemove}
            >
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>

        {item.note ? (
          <Text style={styles.noteText}>{noteText(item.term, item.note)}</Text>
        ) : null}

        <View style={styles.toleranceRow} accessibilityRole="radiogroup">
          {TOLERANCE_OPTIONS.map(option => {
            const selected = item.tolerance === option.value;
            const color = TOLERANCE_COLORS[option.value];

            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.toleranceButton,
                  { borderColor: color },
                  selected && { backgroundColor: color },
                ]}
                onPress={() => changeTolerance(item, option.value)}
                disabled={busy}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${item.term}: ${option.label}`}
              >
                <Text
                  style={[
                    styles.toleranceText,
                    { color: selected ? colors.white : color },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerInfo}>
          <Text style={styles.allergyName}>{allergen.name}</Text>
          <Text style={styles.savedLabel}>✓ Saved to My Allergies</Text>
          {(okCount > 0 || limitCount > 0) && (
            <Text style={styles.summaryText}>
              {[
                okCount > 0 ? `${okCount} OK for me` : null,
                limitCount > 0 ? `${limitCount} small amounts` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={onRemoveAllergy}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${allergen.name} from my allergies`}
        >
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {flaggable.length === 0 ? (
        <Text style={styles.emptyText}>
          No ingredients listed yet. Add ingredients that contain{' '}
          {allergen.name} so FoodBuddy can catch them on labels.
        </Text>
      ) : (
        <>
          {definite.length > 0 && (
            <>
              <Text style={styles.groupTitle}>DEFINITE</Text>
              <Text style={styles.groupHint}>
                Always contains {allergen.name}.
              </Text>
              {definite.map(renderTerm)}
            </>
          )}

          {possible.length > 0 && (
            <>
              <Text style={styles.groupTitle}>POSSIBLE</Text>
              <Text style={styles.groupHint}>
                Sometimes made from {allergen.name}; labels often don't say.
              </Text>
              {possible.map(renderTerm)}
            </>
          )}

          {flaggable.length > COLLAPSED_LIMIT && (
            <TouchableOpacity
              onPress={() => setExpanded(value => !value)}
              accessibilityRole="button"
              style={styles.expandButton}
            >
              <Text style={styles.expandText}>
                {expanded
                  ? 'Show fewer'
                  : `Show all ${flaggable.length} ingredients (${hiddenCount} more)`}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <View style={styles.divider} />

      <Text style={styles.groupTitle}>ADD AN INGREDIENT</Text>

      <TextInput
        style={styles.input}
        placeholder={`Another name for ${allergen.name}`}
        placeholderTextColor="#777"
        value={newTerm}
        onChangeText={setNewTerm}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={addTerm}
        accessibilityLabel={`New ingredient for ${allergen.name}`}
      />

      <View style={styles.addRow}>
        <View style={styles.typeToggle} accessibilityRole="radiogroup">
          {(['definite', 'possible'] as const).map(type => {
            const selected = newType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, selected && styles.typeButtonSelected]}
                onPress={() => setNewType(type)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[styles.typeText, selected && styles.typeTextSelected]}
                >
                  {type === 'definite' ? 'Definite' : 'Possible'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[
            styles.addButton,
            (!newTerm.trim() || saving) && styles.addButtonDisabled,
          ]}
          onPress={addTerm}
          disabled={!newTerm.trim() || saving || busy}
          accessibilityRole="button"
          accessibilityLabel={`Add ingredient to ${allergen.name}`}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.addButtonText}>+ Add</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 18,
    marginBottom: 13,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerInfo: {
    flex: 1,
    paddingRight: 10,
  },
  allergyName: {
    color: colors.blue,
    fontSize: 19,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  savedLabel: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  removeText: {
    color: '#B13C3C',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginVertical: 14,
  },
  groupTitle: {
    color: colors.green,
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  groupHint: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 8,
  },
  termRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  termHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  termName: {
    color: colors.blue,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  customBadge: {
    marginLeft: 8,
    backgroundColor: colors.softBlue,
    color: colors.blue,
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  termRemove: {
    marginLeft: 'auto',
    paddingLeft: 10,
  },
  noteText: {
    color: colors.muted,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 6,
  },
  toleranceRow: {
    flexDirection: 'row',
    gap: 6,
  },
  toleranceButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  toleranceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: '#777',
    fontSize: 14,
    lineHeight: 21,
  },
  expandButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  expandText: {
    color: colors.green,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#D6D6D6',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.blue,
    marginTop: 8,
    marginBottom: 10,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeToggle: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#E6EBE7',
    borderRadius: 9,
    padding: 3,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 7,
  },
  typeButtonSelected: {
    backgroundColor: colors.green,
  },
  typeText: {
    color: colors.green,
    fontWeight: '600',
    fontSize: 13,
  },
  typeTextSelected: {
    color: colors.white,
  },
  addButton: {
    backgroundColor: colors.green,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9,
    minWidth: 76,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#82978E',
  },
  addButtonText: {
    color: colors.white,
    fontWeight: 'bold',
  },
});
