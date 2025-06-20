$(function() {
    var engine = new Worker("js/lozza.js");
    console.log("GUI: uci");
    engine.postMessage("uci");
    console.log("GUI: ucinewgame");
    engine.postMessage("ucinewgame");

    var moveList = [], scoreList =[];
    var cursor = 0;

    var player = 'w';
    var entirePGN = ''; // longer than current PGN when rewind buttons are clicked

    var board;
    var game = new Chess(), // move validation, etc.    
        statusEl = $('#status'),
        fenEl = $('#fen'),
        pgnEl = $('#pgn');

    var engineRunning = false;
    var board3D = ChessBoard3.webGLEnabled();

    if (!board3D) {
        swal("WebGL unsupported or disabled.", "Using a 2D board...");
        $('#dimensionBtn').remove();
    }

    function updateScoreGauge(score) {
        scoreGauge.SonicGauge('val', parseInt(score, 10));
    }

    function adjustBoardWidth() {
        var fudge = 5;
        var windowWidth = $(window).width();
        var windowHeight = $(window).height();
        
        // For mobile devices
        if (windowWidth < 768) {  // Standard mobile breakpoint
            var boardDiv = $('#board');
            // Make side panel stack below board on mobile
            $('#side').css({
                'float': 'none',
                'width': '100%',
                'margin-top': '20px'
            });
            // Make board take full width on mobile
            desiredBoardWidth = windowWidth - (2 * fudge);
            if (board3D) {
                desiredBoardWidth &= 0xFFFC; // mod 4 = 0
                boardDiv.css('width', desiredBoardWidth);
                boardDiv.css('height', (desiredBoardWidth * 0.75));
            } else {
                boardDiv.css('width', desiredBoardWidth);
                boardDiv.css('height', desiredBoardWidth);
            }
        } else {
            // Original desktop logic
            var desiredBoardWidth = windowWidth - $('#side').outerWidth(true) - fudge;
            var desiredBoardHeight = windowHeight - $('#header').outerHeight(true) - $('#banner').outerHeight(true) - $('#footer').outerHeight(true) - fudge;
    
            var boardDiv = $('#board');
            if (board3D) {
                desiredBoardWidth &= 0xFFFC;
                desiredBoardHeight -= (desiredBoardHeight % 3);
                if (desiredBoardWidth * 0.75 > desiredBoardHeight) {
                    desiredBoardWidth = desiredBoardHeight * 4 / 3;
                }
                boardDiv.css('width', desiredBoardWidth);
                boardDiv.css('height', (desiredBoardWidth * 0.75));
            } else {
                desiredBoardWidth = Math.min(desiredBoardWidth, desiredBoardHeight);
                boardDiv.css('width', desiredBoardWidth);
                boardDiv.css('height', desiredBoardHeight);
            }
        }
        
        if (board !== undefined) {
            board.resize();
        }
    }    

    function fireEngine() {
        engineRunning = true;
        updateStatus();
        var currentScore;
        var msg = "position fen "+game.fen();
        console.log("GUI: "+msg);
        engine.postMessage(msg);
        msg = 'go movetime ' + $('#moveTime').val();
        console.log("GUI: "+msg);
        engine.postMessage(msg);
        engine.onmessage = function(event) {
            var line = event.data;
            console.log("ENGINE: "+line);
            var best = parseBestMove(line);
            if (best !== undefined) {
                var move = game.move(best);
                moveList.push(move);
                if (currentScore !== undefined) {
                    if (scoreList.length > 0) {
                        scoreList.pop(); // remove the dummy score for the user's prior move
                        scoreList.push(currentScore); // Replace it with the engine's opinion
                    }
                    scoreList.push(currentScore);// engine's response
                } else {
                    scoreList.push(0); // not expected
                }
                cursor++;
                board.position(game.fen(), true);
                engineRunning = false;
                updateStatus();
            } else {
                var score = parseScore(line);
                if (score !== undefined) {
                    if (player === 'w') {
                        score = -score; // convert from engine's score to white's score
                    }
                    updateScoreGauge(score);
                    currentScore = score;
                }
            }
        };
    }

    function parseBestMove(line) {
        var match = line.match(/bestmove\s([a-h][1-8][a-h][1-8])(n|N|b|B|r|R|q|Q)?/);
        if (match) {
            var bestMove = match[1];
            var promotion = match[2];
            return {
                from: bestMove.substring(0, 2),
                to: bestMove.substring(2, 4),
                promotion: promotion
            }
        }
    }

    function parseScore(line) {
        var match = line.match(/score\scp\s(-?\d+)/);
        if (match) {
            return match[1];
        } else {
            if (line.match(/mate\s-?\d/)) {
                return 2500;
            }
        }
    }

    function updateStatus() {
        var status = '';
        var moveColor = 'White';
        if (game.turn() === 'b') {
            moveColor = 'Black';
        }

        if (game.game_over()) {
            if (game.in_checkmate()) {
                status = moveColor + ' checkmated.';
            } else if (game.in_stalemate()) {
                status = moveColor + " stalemated";
            } else if (game.insufficient_material()) {
                status = "Draw (insufficient material)."
            } else if (game.in_threefold_repetition()) {
                status = "Draw (threefold repetition)."
            } else if (game.in_draw()) {
                status = "Game over (fifty move rule)."
            }
            swal({
                title : "Game Over",
                text : status,
                type: 'info',
                showCancelButton: false,
                confirmButtonColor: "#DD6655",
                onConfirmButtonText: 'OK',
                closeOnConfirm: true
            });
            engineRunning = false;
        }

        fenEl.html(game.fen().replace(/ /g, '&nbsp;'));
        var currentPGN = game.pgn({max_width:10,newline_char:"<br>"});
        var matches = entirePGN.lastIndexOf(currentPGN, 0) === 0;
        if (matches) {
            currentPGN += "<span>" + entirePGN.substring(currentPGN.length, entirePGN.length) + "</span>";
        } else {
            entirePGN = currentPGN;
        }
        pgnEl.html(currentPGN);
        if (engineRunning) {
            status += '';
        }
        statusEl.html(status);
    };

    // Set up chessboard
    var onDrop = function(source, target) {
        if (board.hasOwnProperty('removeGreySquares') && typeof board.removeGreySquares === 'function') {
            board.removeGreySquares();
        }
    
        var move = game.move({
            from: source,
            to: target,
            promotion: $("#promotion").val()
        });
    
        if (move === null) return 'snapback';
    
        if (cursor === 0) {
            console.log("GUI: ucinewgame");
            engine.postMessage("ucinewgame");
        }
        moveList = moveList.slice(0, cursor);
        scoreList = scoreList.slice(0, cursor);
        moveList.push(move);
        scoreList.push(scoreList.length === 0 ? 0 : scoreList[scoreList.length - 1]);
        cursor = moveList.length;
    
        board.position(game.fen(), true);
    };

    var onSnapEnd = function() {
        if (!game.game_over() && game.turn() !== player) {
            fireEngine();
        }
    };

    var onMouseoverSquare = function(square) {
        var moves = game.moves({
            square: square,
            verbose: true
        });

        if (moves.length === 0) return;

        if (board.hasOwnProperty('greySquare') && typeof board.greySquare === 'function') {
            board.greySquare(square);
            for (var i = 0; i < moves.length; i++) {
                board.greySquare(moves[i].to);
            }
        }
    };

    var onMouseoutSquare = function(square, piece) {
        if (board.hasOwnProperty('removeGreySquares') && typeof board.removeGreySquares === 'function') {
            board.removeGreySquares();
        }
    };

    function createBoard(pieceSet) {
        var cfg = {
            cameraControls: true,
            draggable: true,
            position: 'start',
            onDrop: onDrop,
            onMouseoutSquare: onMouseoutSquare,
            onMouseoverSquare: onMouseoverSquare,
            onSnapEnd: onSnapEnd
        };
        if (board3D) {
            if (pieceSet) {
                if (pieceSet === 'minions') {
                    cfg.whitePieceColor = 0xFFFF00;
                    cfg.blackPieceColor = 0xCC00CC;
                    cfg.lightSquareColor = 0x888888;
                    cfg.darkSquareColor = 0x666666;
                }
                cfg.pieceSet = 'assets/chesspieces/' + pieceSet + '/{piece}.json';
            }
            return new ChessBoard3('board', cfg);
        } else {
            return new ChessBoard('board', cfg);
        }
    }

    adjustBoardWidth();
    board = createBoard();

    $(window).resize(function() {
        adjustBoardWidth();
    });

    // Set up buttons
    $('#startBtn').on('click', function() {
        var cursorStart = 0;
        if (player === 'b') {
            cursorStart = 1;
        }
        while (cursor > cursorStart) {
            game.undo();
            cursor--;
        }
        updateScoreGauge(0);
        board.position(game.fen());
        updateStatus();
    });
    $('#endBtn').on('click', function() {
        while (cursor < moveList.length) {
            game.move(moveList[cursor++]);
        }
        board.position(game.fen());
        updateScoreGauge(scoreList.length == 0 ? 0 : scoreList[cursor - 1]);
        updateStatus();
    });
    
    $('#flipBtn').on('click', function() {
        if (game.game_over()) {
            return;
        }
        board.flip();
        player = (player === 'w') ? 'b' : 'w';
        updateStatus();
        setTimeout(fireEngine, 1000);
    });

    $('#dimensionBtn').on('click', function() {
        var dimBtn = $("#dimensionBtn");
        dimBtn.prop('disabled', true);
        var position = board.position();
        var orientation = board.orientation();
        board.destroy();
        board3D = !board3D;
        adjustBoardWidth();
        dimBtn.val(board3D? '2D' : '3D');
        setTimeout(function () {
            board = createBoard($('#piecesMenu').val());
            board.orientation(orientation);
            board.position(position);
            $("#dimensionBtn").prop('disabled', false);
        });
    });

    $("#setFEN").on('click', function(e) {
        swal({
            title: "SET FEN",
            text: "Enter a FEN position below:",
            type: "input",
            inputType: "text",
            showCancelButton: true,
            closeOnConfirm: false
        }, function(fen) {
            if (fen === false) {
                return; //cancel
            }
            fen = fen.trim();
            console.log(fen);
            var fenCheck = game.validate_fen(fen);
            console.log("valid: "+fenCheck.valid);
            if (fenCheck.valid) {
                game = new Chess(fen);
                console.log("GUI: ucinewgame");
                engine.postMessage('ucinewgame');
                console.log("GUI: position fen " + fen);
                engine.postMessage('position fen '+ fen);
                board.position(fen);
                fenEl.val(fen);
                pgnEl.empty();
                updateStatus();
                swal("Success", "FEN parsed successfully.", "success");
            } else {
                console.log(fenCheck.error);
                swal.showInputError("ERROR: "+fenCheck.error);
                return false;
            }
        });
    });

    $("#setPGN").on('click', (function(e) {
        swal({
            title: "SET PGN",
            text: "Enter a game PGN below:",
            type: "input",
            inputType: "text",
            showCancelButton: true,
            closeOnConfirm: false
        }, function(pgn) {
            if (pgn === false) {
                return; // cancel
            }
            pgn = pgn.trim();
            console.log(pgn);
            var pgnGame = new Chess();
            if (pgnGame.load_pgn(pgn)) {
                game = pgnGame;
                var fen = game.fen();
                console.log("GUI: ucinewgame");
                engine.postMessage('ucinewgame');
                console.log("GUI: position fen " + fen);
                engine.postMessage('position fen ' + game.fen());
                board.position(fen, false);
                fenEl.val(game.fen());
                pgnEl.empty();
                moveList = game.history();
                scoreList = [];
                for (var i = 0; i < moveList.length; i++) {
                    scoreList.push(0);
                }
                cursor = moveList.length;
                updateStatus();
                swal("Success", "PGN parsed successfully.", "success");
            } else {
                swal.showInputError("PGN not valid.");
                return false;
            }
        });
    }));

    $("#resetBtn").on('click', function(e) {
        player = 'w';
        game = new Chess();
        fenEl.empty();
        pgnEl.empty();
        largestPGN = '';
        moveList = [];
        scoreList = [];
        cursor = 0;
        board.start();
        board.orientation('white');
        console.log("GUI: ucinewgame");
        engine.postMessage('ucinewgame');
        updateScoreGauge(0);
    });

    $("#engineMenu").change(function() {
       console.log($("#engineMenu").val());
        if (engine) {
            var jsURL = $("#engineMenu").val();
            engine.terminate();
            engine = new Worker(jsURL);
            console.log("GUI: uci");
            engine.postMessage('uci');
            console.log("GUI: ucinewgame");
            engine.postMessage('ucinewgame');
            updateScoreGauge(0);
            if (jsURL.match(/Player/)) {
                swal('Using the tiny p4wn engine, which plays at an amateur level.');
            } else if (jsURL.match(/lozza/)) {
                swal('Using Lozza engine by Colin Jerkins, estimated rating 2340.')
            } else if (jsURL.match(/stockfish/)) {
                swal("Using stockfish engine, estimated rating > 3000.");
            }
        }
    });

    $('#piecesMenu').change(function() {
        var fen = board.position();
        board.destroy();
        board = createBoard($('#piecesMenu').val());
        board.position(fen);
        adjustBoardWidth();
    });

    // New buttons for copying and printing moves
    $('#copyMovesBtn').on('click', function() {
        var movesText = moveList.map(move => move.san).join(', '); // Collect moves in SAN format
        navigator.clipboard.writeText(movesText).then(function() {
            swal("Success", "Moves copied to clipboard!", "success");
        }, function(err) {
            swal("Error", "Failed to copy moves: " + err, "error");
        });
    });

    $('#printMovesBtn').on('click', function() {
        // Vertically stack moves, one per line
        var movesText = moveList.map(move => move.san).join('\n');
        var printWindow = window.open('', '', 'height=400,width=600');
        printWindow.document.write(`
            <html>
            <head>
                <title>Chess Moves</title>
                <style>
                    body { font-family: Arial, sans-serif; }
                    h1 { font-size: 1.5em; }
                    pre { 
                        font-size: 1.2em; 
                        line-height: 1.5; 
                        word-break: break-word; 
                    }
                    @media (max-width: 600px) {
                        body, pre, h1 { font-size: 1.1em !important; }
                        pre { font-size: 1.2em !important; }
                    }
                </style>
            </head>
            <body>
                <h1>Recorded Chess Moves</h1>
                <pre>${movesText}</pre>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    });

    updateStatus();

(function enableMobileTapToPlace() {
    // Only activate on mobile devices
    if (!/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return;

    // Remove drag-and-drop for mobile
    if (typeof board === "object" && board !== null) {
        if (typeof board.draggable !== "undefined") {
            board.draggable = false;
        }
    }

    // Add highlight styles for selected and legal squares
    if (!document.getElementById('mobile-tap-highlight-style')) {
        var style = document.createElement('style');
        style.id = 'mobile-tap-highlight-style';
        style.innerHTML = `
            .highlight-yellow { background: yellow !important; opacity: 0.7 !important; }
            .highlight-green { background: #90ee90 !important; opacity: 0.7 !important; }
        `;
        document.head.appendChild(style);
    }

    let selectedSquare = null;
    let legalDests = [];

    function clearHighlights() {
        $('.square-55d63').removeClass('highlight-yellow highlight-green');
        legalDests = [];
    }

    // Remove any previous handlers to avoid duplicates
    $('#board').off('touchstart');

    // Tap-to-select and tap-to-move logic
    $('#board').on('touchstart', '.square-55d63', function (e) {
        e.preventDefault();
        let square = $(this).attr('data-square');
        let piece = game.get(square);

        // If no square is selected yet
        if (!selectedSquare) {
            // Only allow selecting your own piece
            if (piece && piece.color === game.turn()) {
                selectedSquare = square;
                clearHighlights();
                $(this).addClass('highlight-yellow');
                // Highlight all legal destination squares
                let moves = game.moves({ square: square, verbose: true });
                legalDests = moves.map(m => m.to);
                legalDests.forEach(dest => {
                    $(`.square-55d63[data-square="${dest}"]`).addClass('highlight-green');
                });
            }
        } else {
            // If tapping the same square, deselect
            if (selectedSquare === square) {
                clearHighlights();
                selectedSquare = null;
                return;
            }
            // If tapping a legal destination, move
            if (legalDests.includes(square)) {
                let move = game.move({
                    from: selectedSquare,
                    to: square,
                    promotion: $("#promotion").val()
                });
                if (move) {
                    moveList = moveList.slice(0, cursor);
                    scoreList = scoreList.slice(0, cursor);
                    moveList.push(move);
                    scoreList.push(scoreList.length === 0 ? 0 : scoreList[scoreList.length - 1]);
                    cursor = moveList.length;
                    board.position(game.fen(), true);
                    clearHighlights();
                    selectedSquare = null;
                    updateStatus();
                    if (!game.game_over() && game.turn() !== player) {
                        fireEngine();
                    }
                } else {
                    // Invalid move, just clear selection
                    clearHighlights();
                    selectedSquare = null;
                }
            } else {
                // Tapped elsewhere: if it's another of your pieces, select it
                if (piece && piece.color === game.turn()) {
                    selectedSquare = square;
                    clearHighlights();
                    $(this).addClass('highlight-yellow');
                    let moves = game.moves({ square: square, verbose: true });
                    legalDests = moves.map(m => m.to);
                    legalDests.forEach(dest => {
                        $(`.square-55d63[data-square="${dest}"]`).addClass('highlight-green');
                    });
                } else {
                    // Otherwise, just clear selection
                    clearHighlights();
                    selectedSquare = null;
                }
            }
        }
    });
})();
});