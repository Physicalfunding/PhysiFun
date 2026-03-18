"use client";

import { useState } from "react";
import Image from "next/image";

/** カテゴリ定義 */
const categories = [
  { id: "all", label: "すべて", icon: "📋" },
  { id: "architecture", label: "建築", icon: "🏗️" },
  { id: "cafe", label: "カフェ・飲食", icon: "☕" },
  { id: "camp", label: "キャンプ場", icon: "⛺" },
  { id: "agriculture", label: "農業", icon: "🌾" },
  { id: "event", label: "イベント", icon: "🎪" },
  { id: "sports", label: "スポーツ", icon: "⚽" },
];

/** モックプロジェクトデータ */
const mockProjects: Project[] = [
  {
    id: "1",
    title: "築100年の古民家をDIYリノベーションして、都の自然に癒える施設にしたい！",
    category: "architecture",
    image: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=600&h=400&fit=crop",
    supporters: 100,
    hours: 1000,
    amount: "¥562,000",
    owner: "大志建築",
    instagram: "taishi_kenchiku",
    tags: ["建築", "DIY"],
  },
  {
    id: "2",
    title: "秋田県横手市にある「森林キャンプ場」の運営、森づくりのお手伝い！",
    category: "camp",
    image: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&h=400&fit=crop",
    supporters: 150,
    hours: 1200,
    amount: "",
    owner: "キャンプ・森林",
    instagram: "camp_shinrin",
    tags: ["キャンプ場", "自然"],
  },
  {
    id: "3",
    title: "ボルダリングジムの壁を一緒に作ろう！クライマーの聖地をみんなの手で",
    category: "sports",
    image: "https://images.unsplash.com/photo-1522163182402-834f871fd851?w=600&h=400&fit=crop",
    supporters: 90,
    hours: 800,
    amount: "",
    owner: "西アフリカ円寺ボルダリング",
    instagram: "nishi_boulder",
    tags: ["スポーツ", "DIY"],
  },
  {
    id: "4",
    title: "廃校になった小学校をコミュニティカフェとして復活させたい",
    category: "cafe",
    image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&h=400&fit=crop",
    supporters: 75,
    hours: 600,
    amount: "",
    owner: "まちカフェプロジェクト",
    instagram: "machi_cafe_pj",
    tags: ["カフェ・飲食", "まちづくり"],
  },
  {
    id: "5",
    title: "耕作放棄地を開墾して、みんなの畑をつくるプロジェクト",
    category: "agriculture",
    image: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=600&h=400&fit=crop",
    supporters: 120,
    hours: 950,
    amount: "",
    owner: "里山ファーム",
    instagram: "satoyama_farm",
    tags: ["農業", "自然"],
  },
  {
    id: "6",
    title: "地域の夏祭りを復活！準備から当日運営まで一緒にやりませんか？",
    category: "event",
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&h=400&fit=crop",
    supporters: 200,
    hours: 500,
    amount: "",
    owner: "夏祭り実行委員会",
    instagram: "natsu_matsuri",
    tags: ["イベント", "まちづくり"],
  },
];

type Project = {
  id: string;
  title: string;
  category: string;
  image: string;
  supporters: number;
  hours: number;
  amount: string;
  owner: string;
  instagram: string;
  tags: string[];
};

/**
 * カテゴリフィルター + プロジェクトカード一覧セクション
 */
export function CategorySection() {
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredProjects =
    activeCategory === "all"
      ? mockProjects
      : mockProjects.filter((p) => p.category === activeCategory);

  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* セクションタイトル */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-center text-gray-900 mb-4">
          カテゴリを選んで特徴を見る
        </h2>
        <div className="flex justify-center mb-10">
          <div className="relative inline-block bg-physifun-red text-white font-bold text-sm sm:text-base px-6 py-3 rounded-lg">
            あなたの目的にあった事例がきっとみつかる！
            {/* 吹き出しの三角 */}
            <span className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-physifun-red" />
          </div>
        </div>

        {/* カテゴリタブ */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold transition-all ${
                activeCategory === cat.id
                  ? "bg-physifun-red text-white shadow-lg shadow-physifun-red/30"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <span className="text-lg">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* プロジェクトカード一覧 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectMockCard key={project.id} project={project} />
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <p className="text-center text-gray-500 py-12">
            このカテゴリのプロジェクトはまだありません
          </p>
        )}
      </div>
    </section>
  );
}

/** モックプロジェクトカード */
function ProjectMockCard({ project }: { project: Project }) {
  return (
    <div className="group rounded-xl overflow-hidden bg-white border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      {/* 画像 */}
      <div className="relative h-48 overflow-hidden">
        <Image
          src={project.image}
          alt={project.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {/* タグ */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-[10px] font-bold bg-white/90 backdrop-blur-sm text-gray-700 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* コンテンツ */}
      <div className="p-4">
        <h3 className="text-sm font-bold text-gray-900 leading-snug mb-3 line-clamp-2">
          {project.title}
        </h3>

        {/* オーナー + Instagram */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-500">{project.owner}</span>
          <a
            href={`https://www.instagram.com/${project.instagram}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-pink-500 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
            @{project.instagram}
          </a>
        </div>

        {/* 統計 */}
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-3.5 h-3.5 text-physifun-red"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
            </svg>
            <span className="font-bold">{project.supporters}</span>
            <span>人</span>
          </div>
          <div className="flex items-center gap-1">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-3.5 h-3.5 text-physifun-red"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-bold">{project.hours}</span>
            <span>時間</span>
          </div>
          {project.amount && (
            <div className="ml-auto font-bold text-physifun-red text-sm">{project.amount}</div>
          )}
        </div>
      </div>
    </div>
  );
}
