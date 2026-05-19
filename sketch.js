let video;
let handPose;
let hands = [];

// 遊戲狀態變數
let playerScore = 0;
let computerScore = 0;
let gameState = "WAITING"; // WAITING, COUNTDOWN, SHOW_RESULT, GAME_OVER
let countdownNum = 3;
let timerEpoch = 0;

let playerChoice = "未知";
let computerChoice = "未知";
let roundResult = "";

function preload() {
  // 初始化 HandPose 模型
  handPose = ml5.handPose({ flipped: true });
}

function setup() {
  // 建立畫布並指定放入 HTML 的 'canvas-holder' 容器中
  let canvas = createCanvas(640, 480);
  canvas.parent('canvas-holder');

  // 啟動視訊，並加入針對手機前鏡頭的最佳化設定
  video = createCapture(VIDEO, {
    flipped: true,
    video: {
      facingMode: "user", // 強制使用手機前置鏡頭
      width: { ideal: 640 },
      height: { ideal: 480 }
    }
  });
  video.hide();

  // 開始偵測手勢
  handPose.detectStart(video, gotHands);

  // 更新網頁 UI 狀態
  document.getElementById('status').innerText = "AI 載入完成！點擊下方按鈕開始猜拳";
  document.getElementById('start-btn').disabled = false;
}

function gotHands(results) {
  hands = results;
}

function draw() {
  // ---------------------------------------------------------
  // 1. 影像鏡像處理：只有影像在畫出的時候翻轉，讓畫面像照鏡子一樣直覺
  // ---------------------------------------------------------
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop(); // 畫完影像立刻還原座標軸，確保接下來的點位和文字位置正確

  let detectedChoice = "未偵測到手勢";

  // ---------------------------------------------------------
  // 2. 繪製點位與辨識：在正常座標軸下繪製，藍色點點就能精準對齊雙手
  // ---------------------------------------------------------
  if (hands.length > 0) {
    let hand = hands[0]; // 只抓畫面中的第一隻手
    if (hand.confidence > 0.3) {
      drawHandKeypoints(hand);  // 畫出藍色關節點
      detectedChoice = judgeGesture(hand); // 計算目前手勢
    }
  }

  // 3. 執行遊戲核心流程
  handleGameLogic(detectedChoice);
}

// 畫出手指關鍵點
function drawHandKeypoints(hand) {
  for (let i = 0; i < hand.keypoints.length; i++) {
    let keypoint = hand.keypoints[i];
    fill(0, 255, 255);
    noStroke();
    circle(keypoint.x, keypoint.y, 10);
  }
}

// 核心演算法：依據關鍵點的 Y 軸高度判定「剪刀、石頭、布」
function judgeGesture(hand) {
  let kp = hand.keypoints;

  // 判斷手指是否伸直（指尖 Y 座標小於第二關節 Y 座標，代表在畫面上方）
  let indexOpen  = kp[8].y  < kp[6].y;  // 食指
  let middleOpen = kp[12].y < kp[10].y; // 中指
  let ringOpen   = kp[16].y < kp[14].y; // 無名指
  let pinkyOpen  = kp[20].y < kp[18].y; // 小指

  // 計算有幾隻手指是伸直的
  let openCount = 0;
  if (indexOpen) openCount++;
  if (middleOpen) openCount++;
  if (ringOpen) openCount++;
  if (pinkyOpen) openCount++;

  // 猜拳邏輯判定
  if (openCount === 0) {
    return "石頭";
  } else if (openCount === 2 && indexOpen && middleOpen) {
    return "剪刀";
  } else if (openCount >= 3) {
    return "布";
  }
  return "偵測中...";
}

// 處理倒數計時與畫面顯示文字
function handleGameLogic(detectedChoice) {
  let statusDiv = document.getElementById('status');

  if (gameState === "WAITING") {
    statusDiv.innerText = `目前手勢：${detectedChoice}`;
  } 
  
  else if (gameState === "COUNTDOWN") {
    let elapsed = millis() - timerEpoch;
    if (elapsed < 3000) {
      countdownNum = 3 - Math.floor(elapsed / 1000);
      statusDiv.innerText = `剪刀、石頭... ${countdownNum}`;
      
      // 在畫布中央大字顯示倒數數字
      fill(255, 235, 59);
      textSize(90);
      textAlign(CENTER, CENTER);
      text(countdownNum, width / 2, height / 2);
    } else {
      // 3秒倒數結束，定格抓取這瞬間玩家的手勢
      playerChoice = detectedChoice;
      if (playerChoice !== "石頭" && playerChoice !== "剪刀" && playerChoice !== "布") {
        playerChoice = "石頭"; // 如果沒比好，預設出石頭做防呆
      }
      
      // 電腦隨機出拳
      let choices = ["剪刀", "石頭", "布"];
      computerChoice = random(choices);
      
      // 判定這局誰輸誰贏
      calculateRound(playerChoice, computerChoice);
    }
  } 
  
  else if (gameState === "SHOW_RESULT") {
    // 在畫布上畫出一層半透明黑色遮罩，方便看清結果文字
    rectMode(CENTER);
    fill(0, 0, 0, 160);
    rect(width / 2, height / 2, 480, 220, 15);
    
    fill(255);
    textSize(24);
    textAlign(CENTER);
    text(`你出：${playerChoice}  vs  電腦出：${computerChoice}`, width / 2, height / 2 - 30);
    
    // 根據單局輸贏改變文字顏色
    if (roundResult.includes("你贏")) fill(76, 175, 80); // 綠色
    else if (roundResult.includes("你輸")) fill(244, 67, 54); // 紅色
    else fill(255); // 白色 (平手)
    
    textSize(36);
    text(roundResult, width / 2, height / 2 + 30);
  }
}

// 當點擊 HTML 按鈕時觸發
function startRound() {
  if (playerScore >= 2 || computerScore >= 2) {
    // 如果上一次有人贏了，重新開局時分數歸零
    playerScore = 0;
    computerScore = 0;
    updateScoreBoard();
  }
  gameState = "COUNTDOWN";
  timerEpoch = millis(); // 記錄開始倒數的時間點
  document.getElementById('start-btn').disabled = true;
}

// 比較勝負與處理三戰兩勝
function calculateRound(p, c) {
  if (p === c) {
    roundResult = "平手！再試一次";
  } else if (
    (p === "石頭" && c === "剪刀") ||
    (p === "剪刀" && c === "布") ||
    (p === "布" && c === "石頭")
  ) {
    roundResult = "👍 本局你贏了！";
    playerScore++;
  } else {
    roundResult = "❌ 本局電腦贏了！";
    computerScore++;
  }

  updateScoreBoard();

  // 判斷是否有人拿到兩勝（三戰兩勝制）
  if (playerScore === 2) {
    document.getElementById('status').innerText = "🎉 恭喜！你贏得了最終勝利！";
    gameState = "GAME_OVER";
    document.getElementById('start-btn').innerText = "再玩一次";
    document.getElementById('start-btn').disabled = false;
  } else if (computerScore === 2) {
    document.getElementById('status').innerText = "💀 可惜！電腦贏得了最終勝利！";
    gameState = "GAME_OVER";
    document.getElementById('start-btn').innerText = "再玩一次";
    document.getElementById('start-btn').disabled = false;
  } else {
    // 只是單局結束，顯示結果 3.5 秒後自動回到準備狀態
    gameState = "SHOW_RESULT";
    document.getElementById('status').innerText = "準備下一局...";
    setTimeout(() => {
      gameState = "WAITING";
      document.getElementById('start-btn').innerText = "下一局";
      document.getElementById('start-btn').disabled = false;
    }, 3500);
  }
}

// 將分數同步更新到網頁 HTML 元素上
function updateScoreBoard() {
  document.getElementById('player-score').innerText = playerScore;
  document.getElementById('computer-score').innerText = computerScore;
}