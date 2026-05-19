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

  video = createCapture(VIDEO, {
    flipped: true,
    video: {
      facingMode: "user", // 強制使用手機前置鏡頭
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
  // =======================================================
  // 步驟 1：進入鏡像模式 (左右翻轉)
  // =======================================================
  push(); // 儲存目前的畫布狀態
  translate(width, 0); // 將原點移到右上角
  scale(-1, 1);        // 左右翻轉 X 軸

  // 繪製視訊畫面
  image(video, 0, 0, width, height);

  let detectedChoice = "未偵測到手勢";

  // 確保有偵測到手
  if (hands.length > 0) {
    let hand = hands[0];
    if (hand.confidence > 0.3) {
      drawHandKeypoints(hand);  // 在鏡像狀態下畫出點位
      detectedChoice = judgeGesture(hand); 
    }
  }
  pop(); // 恢復畫布狀態 (跳出鏡像模式，接下來的文字才不會變反字)
  // =======================================================

  // 執行遊戲核心流程 (此時座標軸已恢復正常，字體會是正的)
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

  // 判斷手指是否伸直
  let indexOpen  = kp[8].y  < kp[6].y;  // 食指
  let middleOpen = kp[12].y < kp[10].y; // 中指
  let ringOpen   = kp[16].y < kp[14].y; // 無名指
  let pinkyOpen  = kp[20].y < kp[18].y; // 小指

  let openCount = 0;
  if (indexOpen) openCount++;
  if (middleOpen) openCount++;
  if (ringOpen) openCount++;
  if (pinkyOpen) openCount++;

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
      
      // 在畫布中央大字顯示倒數數字 (正字)
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