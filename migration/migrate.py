# -*- coding: utf-8 -*-
"""
把微信云开发导出的数据迁移到新的 MySQL 库（Spring Boot 后端的那个库）。

数据源：migration/all_data.json —— exportAll 云函数跑出来的原始返回值
目标库：localhost:3306/couple_nest

设计要点
1. 只迁「能对上号」的数据：
   - 旧用户的 openid 必须已经存在于新 user 表（新系统真实登录后才会产生），否则这条数据跳过
   - 旧家庭必须能对应到新 family（按邀请码，或按成员的归属家庭），否则这个家庭的数据整片跳过
2. 不新建用户、不新建家庭 —— 注册和建窝由新后端自己负责
3. 可重复执行：每张表先按业务自然键查重，已存在的跳过，再跑不会插重复
4. 跑完打印每张表的插入/跳过数量与跳过原因

用法：python migration/migrate.py
"""

import json
import pymysql
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ---------------------------------------------------------------- 配置
DB = {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "123456",
    "database": "couple_nest",
    "charset": "utf8mb4",
}

SRC = Path(__file__).with_name("all_data.json")
BEIJING = timezone(timedelta(hours=8))

# 进度统计：表名 -> {"insert": n, "skip": Counter(原因 -> 次数)}
STATS = {}


def insert(table):
    STATS.setdefault(table, {"insert": 0, "skip": Counter()})["insert"] += 1


def skip(table, reason):
    STATS.setdefault(table, {"insert": 0, "skip": Counter()})["skip"][reason] += 1


# ---------------------------------------------------------------- 工具函数
def as_date(value):
    """'2026-09-19' 或 ISO 字符串 -> 'YYYY-MM-DD'；空值 -> None"""
    if value is None:
        return None
    s = str(value).strip()
    return s[:10] if s else None


def as_datetime(value):
    """ISO(UTC) -> 北京时间 'YYYY-MM-DD HH:MM:SS'；空值 -> None"""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(BEIJING)
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def now_str():
    return datetime.now(BEIJING).strftime("%Y-%m-%d %H:%M:%S")


def to_flag(value):
    """云开发里的布尔 -> MySQL 的 0/1"""
    return 1 if value in (True, 1, "1", "true", "True") else 0


def to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def date_range(start, end, cap=90):
    """把 [start, end] 展开成逐天的日期列表；end 为空就只返回 start"""
    if not start:
        return []
    d = datetime.strptime(start, "%Y-%m-%d").date()
    if not end:
        return [d.isoformat()]
    e = datetime.strptime(end, "%Y-%m-%d").date()
    if e < d:
        return [d.isoformat()]
    out = []
    while d <= e and len(out) < cap:
        out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def exists(cur, sql, params):
    """查一行；用 <=> 做 NULL 安全比较，所以可空字段也能正确判重"""
    cur.execute(sql, params)
    return cur.fetchone() is not None


# ---------------------------------------------------------------- 映射关系
def build_maps(cur, cols):
    """建立 旧openid -> 新user、旧user._id -> 新user、旧familyId -> 新familyId 三组映射"""
    cur.execute("SELECT id, openid, family_id, role FROM user")
    new_users = {r[1]: {"id": r[0], "family_id": r[2], "role": r[3]} for r in cur.fetchall()}

    cur.execute("SELECT id, invite_code FROM family")
    new_fam_by_code = {}
    new_fam_ids = set()
    for fid, code in cur.fetchall():
        if code:
            new_fam_by_code[str(code).strip()] = fid
        new_fam_ids.add(fid)

    old_users = cols.get("users", [])
    old_families = cols.get("families", [])

    # 旧 openid -> 新 user 记录
    openid_map = {}
    # 旧 user._id -> 新 user 记录（orders 里存的是旧 user 的 _id）
    old_user_id_map = {}
    for u in old_users:
        oid = u.get("openid") or u.get("_openid")
        nu = new_users.get(oid)
        if not nu:
            continue
        if oid:
            openid_map[oid] = nu
        if u.get("_id"):
            old_user_id_map[u["_id"]] = nu

    # 旧家庭 -> 成员列表
    members_by_family = defaultdict(list)
    for u in old_users:
        if u.get("familyId"):
            members_by_family[u["familyId"]].append(u)

    # 旧 family _id -> 新 family id
    family_map = {}
    for f in old_families:
        old_fid = f.get("_id")
        new_fid = None
        # 1) 邀请码直接对上
        code = str(f.get("familyCode") or "").strip()
        if code and code in new_fam_by_code:
            new_fid = new_fam_by_code[code]
        # 2) 靠成员归属：某个旧成员的 openid 在新库里已经属于某个家庭
        if new_fid is None:
            for u in members_by_family.get(old_fid, []):
                oid = u.get("openid") or u.get("_openid")
                nu = openid_map.get(oid)
                if nu and nu["family_id"] in new_fam_ids:
                    new_fid = nu["family_id"]
                    break
        if new_fid:
            family_map[old_fid] = new_fid

    return {
        "openid": openid_map,
        "old_user_id": old_user_id_map,
        "family": family_map,
        "old_user_count": len(old_users),
        "old_family_count": len(old_families),
    }


def new_user_of(maps, doc):
    """旧记录 -> 新 user 记录：优先按 openid，退回按旧的 userId（旧 user 的 _id）"""
    oid = doc.get("openid") or doc.get("_openid")
    if oid and oid in maps["openid"]:
        return maps["openid"][oid]
    uid = doc.get("userId")
    if uid and uid in maps["old_user_id"]:
        return maps["old_user_id"][uid]
    return None


# ---------------------------------------------------------------- 各表迁移
def migrate_dishes(cur, cols, maps):
    """dishes -> dish；新表没有 price 来源，统一 0；creator 旧数据没有，留空"""
    dish_map = {}
    for d in cols.get("dishes", []):
        fam = maps["family"].get(d.get("familyId"))
        if not fam:
            skip("dish", "家庭未匹配")
            continue
        name = (d.get("name") or "").strip()
        if not name:
            skip("dish", "菜名为空")
            continue
        # 自然键：family_id + name（新库有唯一索引 uk_family_name）
        cur.execute("SELECT id FROM dish WHERE family_id=%s AND name=%s", (fam, name))
        row = cur.fetchone()
        if row:
            dish_map[d["_id"]] = row[0]
            skip("dish", "已存在同家庭同名菜")
            continue
        cur.execute(
            "INSERT INTO dish (family_id, name, category, price, image_url, creator_id, created_at)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (fam, name, d.get("category"), 0, d.get("image") or None, None,
             as_datetime(d.get("createdAt")) or now_str()),
        )
        dish_map[d["_id"]] = cur.lastrowid
        cur.connection.commit()
        insert("dish")
    return dish_map


def migrate_orders(cur, cols, maps, dish_map):
    """orders -> `order`；dish_name 从迁移进来的菜品取快照，status: done -> 1"""
    dish_by_old_id = {d["_id"]: d for d in cols.get("dishes", [])}
    for o in cols.get("orders", []):
        fam = maps["family"].get(o.get("familyId"))
        if not fam:
            skip("order", "家庭未匹配")
            continue
        new_dish_id = dish_map.get(o.get("dishId"))
        if not new_dish_id:
            skip("order", "对应菜品未迁移")
            continue
        dish_name = (dish_by_old_id.get(o.get("dishId"), {}).get("name") or "").strip()
        if not dish_name:
            skip("order", "菜品快照缺失")
            continue
        order_date = as_date(o.get("orderDate"))
        if not order_date:
            skip("order", "下单日期为空")
            continue
        if exists(cur, "SELECT 1 FROM `order` WHERE family_id=%s AND order_date=%s AND dish_id=%s",
                  (fam, order_date, new_dish_id)):
            skip("order", "已存在同家庭同日期同菜品")
            continue
        user = new_user_of(maps, o)
        cur.execute(
            "INSERT INTO `order` (family_id, dish_id, dish_name, price, order_date, creator_id,"
            " status, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (fam, new_dish_id, dish_name, 0, order_date, user["id"] if user else None,
             1 if str(o.get("status")) == "done" else 0,
             as_datetime(o.get("createdAt")) or now_str()),
        )
        cur.connection.commit()
        insert("order")


def migrate_wishes(cur, cols, maps):
    """wishes -> wish；status: '已收到' -> 1，其余（含 '待实现'）-> 0"""
    for w in cols.get("wishes", []):
        fam = maps["family"].get(w.get("familyId"))
        if not fam:
            skip("wish", "家庭未匹配")
            continue
        title = (w.get("title") or "").strip()
        if not title:
            skip("wish", "标题为空")
            continue
        user = new_user_of(maps, w)
        created = as_datetime(w.get("createdAt")) or now_str()
        if exists(cur, "SELECT 1 FROM wish WHERE family_id=%s AND title=%s AND created_at=%s",
                  (fam, title, created)):
            skip("wish", "已存在同家庭同标题同时间的记录")
            continue
        cur.execute(
            "INSERT INTO wish (family_id, title, description, type, budget, link_url, image_url,"
            " creator_id, status, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (fam, title, w.get("description") or "", w.get("type") or "",
             w.get("budget"), w.get("link") or None, w.get("image") or None,
             user["id"] if user else None,
             1 if str(w.get("status")) == "已收到" else 0, created),
        )
        cur.connection.commit()
        insert("wish")


def migrate_moods(cur, cols, maps):
    """moods -> mood；user_id 非空，记录人对不上就跳过"""
    for m in cols.get("moods", []):
        fam = maps["family"].get(m.get("familyId"))
        if not fam:
            skip("mood", "家庭未匹配")
            continue
        user = new_user_of(maps, m)
        if not user:
            skip("mood", "记录人未匹配到新用户")
            continue
        mood_date = as_date(m.get("date"))
        if exists(cur, "SELECT 1 FROM mood WHERE family_id=%s AND user_id=%s AND mood_date <=> %s",
                  (fam, user["id"], mood_date)):
            skip("mood", "已存在同家庭同人同日心情")
            continue
        cur.execute(
            "INSERT INTO mood (family_id, user_id, mood_type, content, mood_date, created_at)"
            " VALUES (%s, %s, %s, %s, %s, %s)",
            (fam, user["id"], m.get("mood"), m.get("note") or None, mood_date,
             as_datetime(m.get("createdAt")) or now_str()),
        )
        cur.connection.commit()
        insert("mood")


def migrate_memos(cur, cols, maps):
    """memos -> memo；isTodo -> is_todo，isCompleted -> done；旧的 isTop 新表没有字段，丢弃"""
    for m in cols.get("memos", []):
        fam = maps["family"].get(m.get("familyId"))
        if not fam:
            skip("memo", "家庭未匹配")
            continue
        title = (m.get("title") or "").strip()
        user = new_user_of(maps, m)
        created = as_datetime(m.get("createdAt")) or now_str()
        if exists(cur, "SELECT 1 FROM memo WHERE family_id=%s AND title=%s AND created_at=%s",
                  (fam, title, created)):
            skip("memo", "已存在同家庭同标题同时间的记录")
            continue
        cur.execute(
            "INSERT INTO memo (family_id, title, content, color, category, is_todo, creator_id,"
            " done, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (fam, title, m.get("content"), m.get("color") or "yellow",
             m.get("category") or "其他", to_flag(m.get("isTodo")),
             user["id"] if user else None, to_flag(m.get("isCompleted")), created),
        )
        cur.connection.commit()
        insert("memo")


def migrate_periods(cur, cols, maps):
    """periods -> period；旧数据是 startDate~endDate 的区间，新表只存单日，按天展开成多行；
    旧的 flow / pain / mood / symptoms 新表没有字段，丢弃。"""
    for p in cols.get("periods", []):
        fam = maps["family"].get(p.get("familyId"))
        if not fam:
            skip("period", "家庭未匹配")
            continue
        user = new_user_of(maps, p)
        if not user:
            skip("period", "记录人未匹配到新用户")
            continue
        days = date_range(as_date(p.get("startDate")), as_date(p.get("endDate")))
        if not days:
            skip("period", "开始日期为空")
            continue
        created = as_datetime(p.get("createdAt")) or now_str()
        for day in days:
            if exists(cur, "SELECT 1 FROM period WHERE family_id=%s AND user_id=%s AND period_date <=> %s",
                      (fam, user["id"], day)):
                skip("period", "该日期已存在")
                continue
            cur.execute(
                "INSERT INTO period (family_id, user_id, period_date, note, created_at)"
                " VALUES (%s, %s, %s, %s, %s)",
                (fam, user["id"], day, p.get("note") or None, created),
            )
            cur.connection.commit()
            insert("period")


def migrate_goals(cur, cols, maps):
    """checkins -> goal + checkin_record
    - 旧 stages 是 [{name, threshold, completed}]，新库要 [{text, completed}]
    - 旧 checkinDates 是 [{date, openid, role}]，拆到 checkin_record 表
    """
    for g in cols.get("checkins", []):
        fam = maps["family"].get(g.get("familyId"))
        if not fam:
            skip("goal", "家庭未匹配")
            continue
        user = new_user_of(maps, g)
        if not user:
            skip("goal", "创建人未匹配到新用户")
            continue
        title = (g.get("title") or "").strip()
        if not title:
            skip("goal", "目标名为空")
            continue
        start_date = as_date(g.get("startDate"))
        if exists(cur, "SELECT 1 FROM goal WHERE family_id=%s AND title=%s AND start_date <=> %s",
                  (fam, title, start_date)):
            skip("goal", "已存在同家庭同目标同开始日期")
            continue

        stages = g.get("stages")
        new_stages = None
        if isinstance(stages, list) and stages:
            new_stages = json.dumps(
                [{"text": s.get("name") or s.get("text") or "",
                  "completed": bool(s.get("completed"))} for s in stages],
                ensure_ascii=False,
            )

        cur.execute(
            "INSERT INTO goal (family_id, creator_id, title, description, icon, mode, frequency,"
            " duration, start_date, end_date, goal_date, status, stages, created_at)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (fam, user["id"], title, g.get("description") or "", g.get("icon") or "🎯",
             g.get("mode") or "checkin", g.get("frequency") or "每天", to_int(g.get("duration")),
             start_date, as_date(g.get("endDate")),
             as_date(g.get("goalDate") or g.get("goal_date")),
             1 if str(g.get("status")) == "completed" else 0, new_stages,
             as_datetime(g.get("createdAt")) or now_str()),
        )
        goal_id = cur.lastrowid
        cur.connection.commit()
        insert("goal")

        for rec in (g.get("checkinDates") or []):
            if not isinstance(rec, dict):
                continue
            day = as_date(rec.get("date"))
            if not day:
                skip("checkin_record", "打卡日期为空")
                continue
            rec_user = new_user_of(maps, rec) or user
            if exists(cur, "SELECT 1 FROM checkin_record WHERE goal_id=%s AND user_id=%s"
                           " AND checkin_date <=> %s", (goal_id, rec_user["id"], day)):
                skip("checkin_record", "已存在同目标同人同日打卡")
                continue
            cur.execute(
                "INSERT INTO checkin_record (goal_id, user_id, checkin_date, created_at)"
                " VALUES (%s, %s, %s, %s)",
                (goal_id, rec_user["id"], day, now_str()),
            )
            cur.connection.commit()
            insert("checkin_record")


# ---------------------------------------------------------------- 报告
def print_report(maps):
    print()
    print("=" * 56)
    print("迁移报告")
    print("=" * 56)
    print(f"用户映射：旧 users {maps['old_user_count']} 条，"
          f"能对上新库 openid 的 {len(maps['openid'])} 条")
    print(f"家庭映射：旧 families {maps['old_family_count']} 条，"
          f"能对上新库 family 的 {len(maps['family'])} 条")
    if not maps["openid"]:
        print()
        print("[提示] 一个旧用户都没匹配上。新库 user 表的 openid 现在全是 mock_openid_*，")
        print("       需要先把后端的 wechat.mock 改成 false 并填上真实 appid/secret，")
        print("       用老公、老婆两个微信号各登录一次新版小程序，产生真实 openid 后再跑本脚本。")
    print()

    total_insert = sum(s["insert"] for s in STATS.values())
    total_skip = sum(sum(s["skip"].values()) for s in STATS.values())
    for table, s in STATS.items():
        reasons = "、".join(f"{k}×{v}" for k, v in s["skip"].most_common()) or "-"
        print(f"{table:<16} 插入 {s['insert']:<4} 跳过 {sum(s['skip'].values()):<4} 原因：{reasons}")
    print("-" * 56)
    print(f"合计：插入 {total_insert} 条，跳过 {total_skip} 条")
    print()
    print("说明：")
    print("- dish.price 旧数据没有，统一写 0；order 的 dish_name 取自迁移进来的菜品快照。")
    print("- memo 的 isTop、period 的 flow/pain/mood/symptoms 新表没有对应字段，未迁移。")
    print("- period 旧数据是区间，新表只存单日，已按天展开成多行。")
    print("- checkins 是打卡页的目标数据，已一起迁到 goal / checkin_record。")


# ---------------------------------------------------------------- 主流程
def main():
    if not SRC.exists():
        print(f"找不到数据文件：{SRC}")
        print("请先把 exportAll 云函数的运行结果保存成 migration/all_data.json")
        return

    obj = json.loads(SRC.read_text(encoding="utf-8"))
    data = obj.get("data", obj)
    cols = data.get("collections", data)  # 兼容「带 collections 包装」与「直接是集合字典」两种结构

    conn = pymysql.connect(**DB)
    cur = conn.cursor()
    try:
        maps = build_maps(cur, cols)
        dish_map = migrate_dishes(cur, cols, maps)
        migrate_orders(cur, cols, maps, dish_map)
        migrate_wishes(cur, cols, maps)
        migrate_moods(cur, cols, maps)
        migrate_memos(cur, cols, maps)
        migrate_periods(cur, cols, maps)
        migrate_goals(cur, cols, maps)
        conn.commit()
    finally:
        cur.close()
        conn.close()

    print_report(maps)


if __name__ == "__main__":
    main()
