/**
 * かぶポケ (KabuPocket) - Google スプレッドシート DB連携用スクリプト (GAS)
 *
 * 【設定手順】
 * 1. 新しいGoogleスプレッドシートを作成します
 * 2. メニューの「拡張機能」＞「Apps Script」を開きます
 * 3. このコードをすべて貼り付けて保存（Ctrl+S / Cmd+S）します
 * 4. 右上の「デプロイ」＞「新しいデプロイ」をクリックします
 * 5. 種類の選択（歯車アイコン）で「ウェブアプリ」を選びます
 *    - 次のユーザーとして実行：「自分」
 *    - アクセスできるユーザー：「全員」
 * 6. 「デプロイ」を押して表示される「ウェブアプリのURL (https://script.google.com/macros/s/.../exec)」を
 *    かぶポケアプリの「スプレッドシート連携」画面に貼り付ければ完了です！
 */

// 必要に応じて合言葉（パスコード）を設定できます（空欄 '' ならチェックなし）
const SECRET_PASSCODE = '';

const SHEET_STOCKS = 'マイ銘柄';
const SHEET_HISTORY = 'ナンピン履歴';

function doGet(e) {
  return handleRequest({
    action: (e && e.parameter && e.parameter.action) || 'load',
    passcode: (e && e.parameter && e.parameter.passcode) || '',
  });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    return handleRequest(body);
  } catch (err) {
    return jsonResponse({ ok: false, error: 'JSON parse error: ' + String(err) });
  }
}

function handleRequest(payload) {
  try {
    if (SECRET_PASSCODE && payload.passcode !== SECRET_PASSCODE) {
      return jsonResponse({ ok: false, error: '合言葉（パスコード）が一致しません' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const stocksSheet = ensureStocksSheet(ss);
    const historySheet = ensureHistorySheet(ss);

    if (payload.action === 'save') {
      if (Array.isArray(payload.savedStocks)) {
        writeStocks(stocksSheet, payload.savedStocks);
      }
      if (Array.isArray(payload.nanpinHistory)) {
        writeHistory(historySheet, payload.nanpinHistory);
      }
      return jsonResponse({
        ok: true,
        message: 'スプレッドシートに保存しました',
        updatedAt: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'MM/dd HH:mm'),
      });
    }

    // Default: action === 'load'
    const savedStocks = readStocks(stocksSheet);
    const nanpinHistory = readHistory(historySheet);

    return jsonResponse({
      ok: true,
      savedStocks: savedStocks,
      nanpinHistory: nanpinHistory,
      updatedAt: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'MM/dd HH:mm'),
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function ensureStocksSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_STOCKS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_STOCKS);
    const headers = [
      'ID',
      '証券コード',
      '銘柄名',
      '現在株価',
      '取得単価',
      '保有株数',
      '1株配当',
      '優待換算額',
      'タグ',
      'メモ',
      '更新日',
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet
      .getRange(1, 1, 1, headers.length)
      .setBackground('#059669')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureHistorySheet(ss) {
  let sheet = ss.getSheetByName(SHEET_HISTORY);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_HISTORY);
    const headers = [
      'ID',
      '銘柄・ラベル',
      '保有株数',
      '旧取得単価',
      '追加株数',
      '追加株価',
      '新平均単価',
      '合計投資額',
      '作成日時',
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet
      .getRange(1, 1, 1, headers.length)
      .setBackground('#4f46e5')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function writeStocks(sheet, stocks) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 11).clearContent();
  }
  if (!stocks.length) return;

  const rows = stocks.map(function (s) {
    return [
      s.id || 'stock-' + new Date().getTime(),
      s.code || '',
      s.name || '',
      Number(s.currentPrice) || 0,
      Number(s.avgBuyPrice) || 0,
      Number(s.shares) || 0,
      Number(s.dividendPerShare) || 0,
      Number(s.perkValue) || 0,
      s.tag || '気になる',
      s.memo || '',
      s.updatedAt || '',
    ];
  });
  sheet.getRange(2, 1, rows.length, 11).setValues(rows);
}

function readStocks(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  return values
    .filter(function (r) {
      return String(r[2] || '').trim() !== '';
    })
    .map(function (r, idx) {
      return {
        id: String(r[0] || 'sheet-' + idx),
        code: String(r[1] || ''),
        name: String(r[2] || ''),
        currentPrice: Number(r[3]) || 0,
        avgBuyPrice: Number(r[4]) || 0,
        shares: Number(r[5]) || 100,
        dividendPerShare: Number(r[6]) || 0,
        perkValue: Number(r[7]) || 0,
        tag: r[8] === '保有中' || r[8] === 'NISA候補' ? r[8] : '気になる',
        memo: String(r[9] || ''),
        updatedAt: String(r[10] || 'シート同期'),
      };
    });
}

function writeHistory(sheet, history) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 9).clearContent();
  }
  if (!history.length) return;

  const rows = history.map(function (h) {
    return [
      h.id || 'hist-' + new Date().getTime(),
      h.label || '',
      Number(h.currentShares) || 0,
      Number(h.currentAvgPrice) || 0,
      Number(h.addShares) || 0,
      Number(h.addPrice) || 0,
      Number(h.newAvgPrice) || 0,
      Number(h.totalInvestment) || 0,
      h.createdAt || '',
    ];
  });
  sheet.getRange(2, 1, rows.length, 9).setValues(rows);
}

function readHistory(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  return values
    .filter(function (r) {
      return String(r[1] || '').trim() !== '';
    })
    .map(function (r, idx) {
      return {
        id: String(r[0] || 'hist-' + idx),
        label: String(r[1] || ''),
        currentShares: Number(r[2]) || 0,
        currentAvgPrice: Number(r[3]) || 0,
        addShares: Number(r[4]) || 0,
        addPrice: Number(r[5]) || 0,
        newAvgPrice: Number(r[6]) || 0,
        totalInvestment: Number(r[7]) || 0,
        createdAt: String(r[8] || ''),
      };
    });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
