"use client";

import Image from "next/image";
import Link from "next/link";
import { Category } from "@/domain/project/entities/Project";

/**
 * プロジェクトカードに表示するデータの型定義
 * APIレスポンスのPublishedProjectDto形式に対応
 */
export interface ProjectCardProps {
  id: string;
  title: string;
  summary: string;
  category: Category;
  location: string;
  imageUrl: string | null;
  /** 画像を優先読み込みするか（LCP最適化用、最初の数枚の画像に適用） */
  priority?: boolean;
}

/**
 * カテゴリを日本語表示に変換するヘルパー関数
 */
const getCategoryLabel = (category: Category): string => {
  const labels: Record<Category, string> = {
    KOMINKA: "古民家再生",
    RICE_FARMING: "米作り",
    DIY: "DIY",
    CRAFT: "クラフト",
    OTHER: "その他",
  };
  return labels[category] || "その他";
};

/**
 * カテゴリに応じた背景色を返すヘルパー関数
 */
const getCategoryColor = (category: Category): string => {
  const colors: Record<Category, string> = {
    KOMINKA: "bg-amber-100 text-amber-800",
    RICE_FARMING: "bg-green-100 text-green-800",
    DIY: "bg-blue-100 text-blue-800",
    CRAFT: "bg-purple-100 text-purple-800",
    OTHER: "bg-gray-100 text-gray-800",
  };
  return colors[category] || "bg-gray-100 text-gray-800";
};

/**
 * ProjectCard コンポーネント
 * ホームページでプロジェクトを一覧表示するためのカードUI
 *
 * 表示項目:
 * - プロジェクト画像（なければプレースホルダー）
 * - タイトル
 * - カテゴリラベル
 * - 概要
 * - 開催場所
 */
export function ProjectCard({
  id,
  title,
  summary,
  category,
  location,
  imageUrl,
  priority = false,
}: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${id}`}
      className="group block bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300"
    >
      {/* プロジェクト画像 */}
      <div className="relative h-48 w-full bg-gray-200">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={priority}
          />
        ) : (
          // 画像がない場合のプレースホルダー
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <svg
              className="w-16 h-16 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* カード情報 */}
      <div className="p-4">
        {/* カテゴリラベル */}
        <span
          className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(category)}`}
        >
          {getCategoryLabel(category)}
        </span>

        {/* タイトル */}
        <h3 className="mt-2 text-lg font-semibold text-gray-900 line-clamp-2 group-hover:text-orange-600 transition-colors">
          {title}
        </h3>

        {/* 概要 */}
        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{summary}</p>

        {/* 開催場所 */}
        <div className="mt-3 flex items-center text-sm text-gray-500">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span>{location}</span>
        </div>
      </div>
    </Link>
  );
}
