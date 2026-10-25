<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Entry;
use App\Models\Recurring;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function save(Request $r, ?Category $category = null)
    {
        $v = $r->validate(['name' => ['required', 'string', 'max:80', Rule::unique('categories')->where('kind', $r->input('kind'))->ignore($category?->id)], 'kind' => 'required|in:income,expense', 'color' => 'required|regex:/^#[a-fA-F0-9]{6}$/', 'icon' => 'required|string|max:30', 'active' => 'boolean', 'mode' => 'sometimes|in:limit,payment']);
        $v['mode'] = $v['mode'] ?? $category?->mode ?? 'payment';
        if ($category?->exists && $category->kind !== $v['kind'] && (Entry::where('category_id', $category->id)->exists() || Recurring::where('category_id', $category->id)->exists())) {
            abort(422, 'Тип используемой категории менять нельзя.');
        }
        $entity = $category?->exists ? $category : new Category;
        $entity->fill($v)->save();

        return $entity;
    }

    public function archive(Category $category)
    {
        DB::transaction(function () use ($category) {
            $category->update(['active' => false]);
            Recurring::where('category_id', $category->id)->update(['active' => false]);
        });

        return response()->noContent();
    }
}
