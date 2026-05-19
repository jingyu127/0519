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
  let canvas = createCanvas(640, 480);
  canvas.parent('canvas-holder');

  // 啟動視訊，強制使用手機前置鏡頭
  video = createCapture(VIDEO, {
    flipped: true,
    video: {
      facingMode: "user",
      width: { ideal: 640 },
      height: { ideal: 480 }
    }
  });
  video.hide();

  handPose.detectStart(video, gotHands);

  document.getElementById('status').innerText = "AI 載入完成！點擊下方按鈕開始猜拳";
  document.getElementById('start-btn').disabled = false;
}

function gotHands(results) {
  hands = results;
}

function draw() {
  // ---------------------------------------------------------
  // 1. 影像與點位鏡像處理 (進入翻轉模式)
  // ---------------------------------------------------------
  push();
  translate(width, 0);
  scale(-1, 1); // 左右翻轉畫布

  // 在翻轉模式下畫影像，畫面絕對是鏡像（照鏡子狀態）
  image(video, 0, 0, width, height);

  let detectedChoice = "未偵測到手勢";

  if (hands.length > 0) {
    let hand = hands[0]; 
    if (hand.confidence > 0.3) {
      // 在翻轉模式下畫點位，藍色點點會精準黏在手勢上
      drawHandKeypoints(hand);  
      
      // 傳入判斷邏輯
      detectedChoice = judgeGesture(hand); 
    }
  }
  pop(); // 畫完影像與點位立刻還原畫布，確保接下來的遊戲 UI 文字是正的
  // ---------------------------------------------------------

  // 2. 執行遊戲核心流程
  handleGameLogic(detectedChoice);
}

// 畫出手指關鍵點 (直接用點位原始座標即可精準對齊)
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

  // 修正點位判定：
  // 因為手機瀏覽器與鏡頭翻轉的關係，指尖與第二關節的 Y 軸在非同步更新下容易誤判
  // 我們改用更精準的「指尖（Tip）與手掌中心/手腕根部（kp[0]）的距離」來判斷手指有沒有伸直！
  // 這樣一來，不論畫面怎麼左右翻轉，距離（Distance）永遠是固定的，絕對不會受鏡像影響！
  
  let baseDist = dist(kp[0].x, kp[0].y, kp[9].x, kp[9].y); // 用手掌大小當作基準距離

  // 如果指尖到手腕的距離，大於手掌基準的 1.6 倍，代表手指伸直了
  let indexOpen  = dist(kp[0].x, kp[0].y, kp[8].x, kp[8].y)  > baseDist * 1.6;  // 食指
  let middleOpen = dist(kp[0].x, kp[0].y, kp[12].x, kp[12].y) > baseDist * 1.6; // 中指
  let ringOpen   = dist(kp[0].x, kp[0].y, kp[16].x, kp[16].y) > baseDist * 1.6; // 無名指
  let pinkyOpen  = dist(kp[0].x, kp[0].y, kp[20].x, kp[20].y) > baseDist * 1.6; // 小指

  // 計算有幾隻手指是伸直的
  let openCount = 0;
  if (indexOpen) openCount++;
  if (middleOpen) openCount++;
  if (ringOpen) openCount++;
  if (pinkyOpen) openCount++;

  // 猜拳邏輯判定
  if (openCount <= 1) {
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
      
      fill(255, 235, 59);
      textSize(90);
      textAlign(CENTER, CENTER);
      text(countdownNum, width / 2, height / 2);
    } else {
      playerChoice = detectedChoice;
      if (playerChoice !== "石頭" && playerChoice !== "剪刀" && playerChoice !== "布") {
        playerChoice = "石頭"; 
      }
      
      let choices = ["剪刀", "石頭", "布"];
      computerChoice = random(choices);
      
      calculateRound(playerChoice, computerChoice);
    }
  } 
  
  else if (gameState === "SHOW_RESULT") {
    rectMode(CENTER);
    fill(0, 0, 0, 160);
    rect(width / 2, height / 2, 480, 220, 15);
    
    fill(255);
    textSize(24);
    textAlign(CENTER);
    text(`你出：${playerChoice}  vs  電腦出：${computerChoice}`, width / 2, height / 2 - 30);
    
    if (roundResult.includes("你贏")) fill(76, 175, 80); 
    else if (roundResult.includes("你輸")) fill(244, 67, 54); 
    else fill(255); 
    
    textSize(36);
    text(roundResult, width / 2, height / 2 + 30);
  }
}

// 當點擊 HTML 按鈕時觸發
function startRound() {
  if (playerScore >= 2 || computerScore >= 2) {
    playerScore = 0;
    computerScore = 0;
    updateScoreBoard();
  }
  gameState = "COUNTDOWN";
  timerEpoch = millis(); 
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
    gameState = "SHOW_RESULT";
    document.getElementById('status').innerText = "準備下一局...";
    setTimeout(() => {
      gameState = "WAITING";
      document.getElementById('start-btn').innerText = "下一局";
      document.getElementById('start-btn').disabled = false;
    }, 3500);
  }
}

function updateScoreBoard() {
  document.getElementById('player-score').innerText = playerScore;
  document.getElementById('computer-score').innerText = computerScore;
}