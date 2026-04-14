import { describe, expect, it } from 'vitest'

import {
  buildRecipeAwareGroceryGap,
  filterRecipesByPlanningState,
  getRecipeKey,
  normaliseCookbookRecipe,
} from './NutritionScreen'

describe('NutritionScreen recipe planning helpers', () => {
  it('keeps the cookbook view filtered to cookbook recipes only', () => {
    const breakfastRecipe = normaliseCookbookRecipe({
      key: 'breakfast-omelet',
      recipe_name: 'Omelet Plate',
      meal_type: 'breakfast',
      ingredients: ['Eggs', 'Spinach'],
    })
    const lunchRecipe = normaliseCookbookRecipe({
      key: 'lunch-wrap',
      recipe_name: 'Turkey Wrap',
      meal_type: 'lunch',
      ingredients: ['Turkey', 'Wrap'],
    })
    const dinnerRecipe = normaliseCookbookRecipe({
      key: 'dinner-bowl',
      recipe_name: 'Salmon Rice Bowl',
      meal_type: 'dinner',
      ingredients: ['Salmon', 'Rice'],
    })

    const filtered = filterRecipesByPlanningState({
      recipes: [breakfastRecipe, lunchRecipe, dinnerRecipe],
      cookbookRecipes: [lunchRecipe, dinnerRecipe],
      collectionFilter: 'cookbook',
      mealFilter: 'all',
      searchQuery: '',
    })

    expect(filtered.map(recipe => getRecipeKey(recipe))).toEqual([
      'lunch-wrap',
      'dinner-bowl',
    ])
  })

  it('filters recipes by dietary tag and preserves recipe tags/images during normalization', () => {
    const recipe = normaliseCookbookRecipe({
      key: 'dinner-salmon-bowl',
      recipe_name: 'Salmon Bowl',
      meal_type: 'dinner',
      ingredients: ['Salmon', 'Rice', 'Cucumber'],
      dietary_tags: ['mediterranean', 'high_protein', 'mediterranean'],
      image_url: 'https://example.com/salmon-bowl.png',
    })

    expect(recipe.dietary_tags).toEqual(['mediterranean', 'high_protein'])
    expect(recipe.image_url).toBe('https://example.com/salmon-bowl.png')

    const filtered = filterRecipesByPlanningState({
      recipes: [recipe],
      cookbookRecipes: [],
      collectionFilter: 'all',
      dietaryFilter: 'mediterranean',
      mealFilter: 'all',
      searchQuery: '',
    })

    expect(filtered.map(item => getRecipeKey(item))).toEqual(['dinner-salmon-bowl'])
  })

  it('keeps cookbook-derived shopping items visible after selection is cleared until user action removes them', () => {
    const result = buildRecipeAwareGroceryGap(
      {
        missing_items: [],
        manual_items: [
          { item_name: 'Rice' },
          { item_name: 'Greek Yogurt' },
        ],
        hidden_item_keys: [],
      },
      [
        normaliseCookbookRecipe({
          key: 'dinner-bowl',
          recipe_name: 'Salmon Rice Bowl',
          meal_type: 'dinner',
          ingredients: ['Salmon', 'Rice'],
        }),
      ],
      [],
      [],
    )

    expect(result.missing_items.map(item => item.item_name)).toEqual([
      'Rice',
      'Greek Yogurt',
    ])
  })
})
