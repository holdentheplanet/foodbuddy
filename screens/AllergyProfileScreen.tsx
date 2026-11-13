
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { db } from '../database/db';
import {
  searchAllergens,
  addCustomAllergen,
  getUserAllergyProfile,
  addUserAllergy,
  removeUserAllergy,
} from '../database/allergyCatalog';

type Allergen = {
  id: number;
  name: string;
};

type Props = {
  userId: number;
};

const GREEN = '#183D32';
const BLUE = '#172B4D';
const CREAM = '#F7F5EF';

export default function AllergyProfileScreen({ userId }: Props) {
  const [section, setSection] = useState<'search' | 'saved'>('saved');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Allergen[]>([]);
  const [selected, setSelected] = useState<Allergen[]>([]);
  const [derivatives, setDerivatives] = useState<Record<number, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadProfile = useCallback(async () => {
    const allergies = await getUserAllergyProfile(userId);
    setSelected(allergies);

    const nextDerivatives: Record<number, string[]> = {};

    for (const allergy of allergies) {
      const rows = await db.getAllAsync<{ ingredient_name: string }>(
        `SELECT ingredient_name
         FROM allergen_derivatives
         WHERE allergen_id = ?
         ORDER BY ingredient_name`,
        [allergy.id]
      );

      nextDerivatives[allergy.id] = rows.map(
        row => row.ingredient_name
      );
    }

    setDerivatives(nextDerivatives);
  }, [userId]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      try {
        await loadProfile();
      } catch (error) {
        console.error(error);
        if (active) {
          Alert.alert('Error', 'Could not load your allergy profile.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [loadProfile]);

  useEffect(() => {
    let active = true;

    async function loadSearchResults() {
      try {
        const matches = await searchAllergens(search, userId);

        if (active) {
          setResults(matches);
        }
      } catch (error) {
        console.error('Allergy search error:', error);
      }
    }

    loadSearchResults();

    return () => {
      active = false;
    };
  }, [search, userId]);

  async function addAllergy(allergen: Allergen) {
    if (busy) return;

    setBusy(true);

    try {
      await addUserAllergy(userId, allergen.id);
      await loadProfile();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not save this allergy.');
    } finally {
      setBusy(false);
    }
  }

  async function removeAllergy(allergen: Allergen) {
    if (busy) return;

    setBusy(true);

    try {
      await removeUserAllergy(userId, allergen.id);
      await loadProfile();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not remove this allergy.');
    } finally {
      setBusy(false);
    }
  }

  async function addCustom() {
    const name = search.trim();

    if (!name || busy) return;

    setBusy(true);

    try {
      const id = await addCustomAllergen(userId, name);
      await addUserAllergy(userId, id);
      await loadProfile();

      setSearch('');
      setSection('saved');

      Alert.alert('Saved', `${name} was added to your allergies.`);
    } catch (error) {
      console.error(error);

      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Could not add this allergy.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>My Allergy Profile</Text>

      <Text style={styles.subtitle}>
        Manage your food allergies and related ingredients.
      </Text>

      <View style={styles.sectionTabs}>
        <TouchableOpacity
          style={[
            styles.sectionTab,
            section === 'search' && styles.selectedSectionTab,
          ]}
          onPress={() => setSection('search')}
        >
          <Text
            style={[
              styles.sectionTabText,
              section === 'search' && styles.selectedSectionTabText,
            ]}
          >
            Find Allergies
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.sectionTab,
            section === 'saved' && styles.selectedSectionTab,
          ]}
          onPress={() => setSection('saved')}
        >
          <Text
            style={[
              styles.sectionTabText,
              section === 'saved' && styles.selectedSectionTabText,
            ]}
          >
            My Saved ({selected.length})
          </Text>
        </TouchableOpacity>
      </View>

      {section === 'search' && (
        <>
          <Text style={styles.sectionTitle}>Find Allergies</Text>

          <Text style={styles.description}>
            Search for foods you are allergic to. You can also add
            allergies that aren't in our catalog.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Search milk, corn, garlic, etc."
            placeholderTextColor="#777"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.sectionTitle}>Search Results</Text>

          {results.length === 0 ? (
            <Text style={styles.emptyText}>
              No matching allergies found. Try adding a custom allergy.
            </Text>
          ) : (
            results.map(allergen => {
              const alreadyAdded = selected.some(
                item => item.id === allergen.id
              );

              return (
                <View key={allergen.id} style={styles.resultRow}>
                  <Text style={styles.resultName}>
                    {allergen.name}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.smallButton,
                      alreadyAdded && styles.addedButton,
                    ]}
                    onPress={() => addAllergy(allergen)}
                    disabled={alreadyAdded || busy}
                  >
                    <Text style={styles.smallButtonText}>
                      {alreadyAdded ? 'Added ✓' : '+ Add'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          {search.trim().length > 0 && (
            <TouchableOpacity
              style={styles.customButton}
              onPress={addCustom}
              disabled={busy}
            >
              <Text style={styles.customButtonText}>
                + Save "{search.trim()}" as an Allergy
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.viewSavedButton}
            onPress={() => setSection('saved')}
          >
            <Text style={styles.viewSavedButtonText}>
              View My Saved Allergies ({selected.length}) →
            </Text>
          </TouchableOpacity>
        </>
      )}

      {section === 'saved' && (
        <>
          <Text style={styles.sectionTitle}>
            My Saved Allergies
          </Text>

          <Text style={styles.description}>
            These allergies are saved to your FoodBuddy account.
            Related ingredients are shown when available.
          </Text>

          {selected.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                No allergies saved yet
              </Text>

              <Text style={styles.emptyText}>
                Start by searching for foods you're allergic to.
              </Text>

              <TouchableOpacity
                style={styles.startButton}
                onPress={() => setSection('search')}
              >
                <Text style={styles.startButtonText}>
                  + Add My First Allergy
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            selected.map(allergen => (
              <View
                key={allergen.id}
                style={styles.allergyCard}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.allergyInfo}>
                    <Text style={styles.allergyName}>
                      {allergen.name}
                    </Text>

                    <Text style={styles.savedLabel}>
                      ✓ Saved to My Allergies
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => removeAllergy(allergen)}
                    disabled={busy}
                  >
                    <Text style={styles.removeText}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.cardDivider} />

                <Text style={styles.derivativeTitle}>
                  Known Related Ingredients
                </Text>

                {(derivatives[allergen.id] || []).length > 0 ? (
                  <Text style={styles.derivativeText}>
                    {derivatives[allergen.id].join(', ')}
                  </Text>
                ) : (
                  <Text style={styles.emptyText}>
                    No related ingredients documented yet.
                    This does not mean the food has no derivatives.
                  </Text>
                )}
              </View>
            ))
          )}

          {selected.length > 0 && (
            <TouchableOpacity
              style={styles.addMoreButton}
              onPress={() => setSection('search')}
            >
              <Text style={styles.addMoreButtonText}>
                + Add More Allergies
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>
          Important Allergy Information
        </Text>

        <Text style={styles.warningText}>
          FoodBuddy's ingredient catalog is incomplete and is not a
          substitute for checking food labels, contacting manufacturers,
          or following medical advice. Ingredient names, processing,
          and cross-contact can affect allergy risk.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CREAM,
  },
  content: {
    padding: 22,
    paddingBottom: 45,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: CREAM,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: BLUE,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 12,
    lineHeight: 22,
  },
  sectionTabs: {
    flexDirection: 'row',
    backgroundColor: '#E6EBE7',
    borderRadius: 12,
    padding: 4,
    marginTop: 15,
    marginBottom: 22,
  },
  sectionTab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 9,
  },
  selectedSectionTab: {
    backgroundColor: GREEN,
  },
  sectionTabText: {
    color: GREEN,
    fontWeight: '600',
    fontSize: 14,
  },
  selectedSectionTabText: {
    color: 'white',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: GREEN,
    marginTop: 12,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 21,
    marginBottom: 15,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#D6D6D6',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: BLUE,
    marginBottom: 18,
  },
  resultRow: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 13,
    marginBottom: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultName: {
    color: BLUE,
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  smallButton: {
    backgroundColor: GREEN,
    paddingHorizontal: 17,
    paddingVertical: 9,
    borderRadius: 9,
  },
  addedButton: {
    backgroundColor: '#82978E',
  },
  smallButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  customButton: {
    borderWidth: 2,
    borderColor: GREEN,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  customButtonText: {
    color: GREEN,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  viewSavedButton: {
    backgroundColor: GREEN,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  viewSavedButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#777',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 22,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: BLUE,
    marginBottom: 10,
  },
  startButton: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 13,
    marginTop: 12,
  },
  startButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  allergyCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 18,
    marginBottom: 13,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  allergyInfo: {
    flex: 1,
    paddingRight: 10,
  },
  allergyName: {
    color: BLUE,
    fontSize: 19,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  savedLabel: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '600',
  },
  removeText: {
    color: '#B13C3C',
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginBottom: 14,
  },
  derivativeTitle: {
    color: GREEN,
    fontWeight: 'bold',
    marginBottom: 7,
  },
  derivativeText: {
    color: '#555',
    fontSize: 14,
    lineHeight: 22,
  },
  addMoreButton: {
    borderWidth: 2,
    borderColor: GREEN,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  addMoreButtonText: {
    color: GREEN,
    fontWeight: 'bold',
  },
  warningBox: {
    backgroundColor: '#FFF0D9',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  warningTitle: {
    color: '#775014',
    fontWeight: 'bold',
    marginBottom: 7,
  },
  warningText: {
    color: '#775014',
    fontSize: 13,
    lineHeight: 20,
  },
});

