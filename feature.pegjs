{
  var MATHBACK = {};
  for(var key in options.MATH){
    MATHBACK[options.MATH[key]] = key;
  }
	function toMath(op, args) {
      return new parsedFeature(MATHBACK[op], args, "function", location());
  }
  function parsedFeature(name, args, type, location) {
    this.type = type
    this.name = name;
    this.args = args;
    this.location = location;
    this.error = null;
    this.cleanup = function () {
        switch (this.type) {
            case "function":
                let ret = {};
                ret[this.name] = this.args.map(function (value) { return value.cleanup(); });
                return ret;
            default:
                return this.name;
        }
    }
    this.check = function (err) {
        let subtype = null;
        if (this.args !== null)
            subtype = this.args.map(function (value) { return value.check(err); })
        return options.specification.check(this, subtype, err);
    }
  }
}

Result = _ f:Level0? _ { return f; }

Level0
  = head:Level1 tail:(_ level0Op _ Level1)* {
      return tail.reduce(function(result, element) {
      	return toMath(element[1], [result, element[3]]);
      }, head);
    }
    
level0Op "Operator"
  = ( ">=" / "<=" / "=" / ">" / "<")

Level1
  = head:Level2 tail:(_ level1Op _ Level2)* {
      return tail.reduce(function(result, element) {
      	return toMath(element[1], [result, element[3]]);
      }, head);
    }
    
level1Op "Operator"
  = ("+" / "-" / "||")

Level2
  = head:Level3 tail:(_ level2Op _ Level3)* {
      return tail.reduce(function(result, element) {
      	return toMath(element[1], [result, element[3]]);
      }, head);
    }

level2Op "Operator"
  = ("*" / "/" / "&&")

Level3
	= "(" id:Level0 ")" { return id; }
    / Feature

Feature
   = _ c:Const _ { return c; } /
     _ id:Identifier _ '(' args:Arguments ')' { return new parsedFeature(id, args, "function", location());} /
     _ id:Identifier _ { return new parsedFeature(id, null, "feature", location()); }

Arguments =
	a:(f:Level0 ',' { return f;})* f:Level0 { return a.concat([f]);}

Const "Constant"
  = Integer / Bool

Identifier "Feature"
  = [a-z0-9_]i+ { return text(); }

Integer
  =([0-9]+[.]?[0-9]*/[.][0-9]+) { return new parsedFeature(Number(text()), null, "number", location()); }
  
Bool
  = ('true'i/'false'i) { return new parsedFeature(text().toLowerCase() == "true", null, "boolean", location()); }

_ "whitespace"
  = [ \t\n\r]*
