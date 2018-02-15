{
  var iana_ies = options.iana_ies;
  var own_ies = options.own_ies;
  var feature_aliases = options.feature_aliases;
  var MATHBACK = {};
  for(var key in options.MATH){
    MATHBACK[options.MATH[key]] = key;
  }
	function toMath(op, args) {
      return new parsedFeature(MATHBACK[op], args, "operation", location());
  }
  var ParseWarning = options.ParseWarning;
  function createFakeFeature(base, fake) {
    switch(typeof fake) {
      case "number":
        return new parsedFeature(fake, null, "number", base.location, base.name);
      case "boolean":
        return new parsedFeature(fake, null, "boolean", base.location, base.name);
      case "string":
        return new parsedFeature(fake, null, "feature", base.location, base.name);
      case "object":
        let key = Object.keys(fake)[0];
        let args = fake[key].map(arg => {
          return createFakeFeature(base, arg);
        });
        return new parsedFeature(key, args, "operation", base.location, base.name);
    }
    throw "This should never happen";
  }
  function parsedFeature(name, args, type, location, fake) {
    this.type = type;
    this.name = name;
    this.args = args;
    this.location = location;
    this.fake = fake;
    this.cleanup = function () {
        switch (this.type) {
            case "operation":
                let ret = {};
                ret[this.name] = this.args.map(function (value) { return value.cleanup(); });
                return ret;
            default:
                return this.name;
        }
    }

    this.check = function (specerror, want, context) {
      let errors = [];
      let feature = feature_aliases[this.name];
      if (feature === undefined)
        feature = this;
      else
        feature = createFakeFeature(this, feature);
      // check name here
      if (feature.args === null) {
        if (want === undefined)
          return true;
        let {ok, hint} = options.specification.isValid(feature, want, context);
        if (ok)
          return true;
        return [new ParseWarning("Wanted "+want+", but '"+feature.name+"' is "+options.specification.type(feature)+"."+(hint.length > 0 ? [""].concat(hint).join(" ") : ""), feature)];
      } else {
        let {variants, hints} = options.specification.arguments(feature, want, specerror, context);
        if (variants.length == 0) {
          variants = options.specification.arguments(feature).variants;
          return [new ParseWarning("Wanted "+want+", but '"+feature.name+"' is "+variants.map(function(variant) {return variant.ret}).join(" or ")+"."+(hints.length > 0 ? [""].concat(hints).join(" ") : ""), feature)];
        }
        let overall = false;
        for(let variant of variants) {
          let result = true;
          for(let i=0; i<variant.args.length; i++) {
            let error = feature.args[i].check(specerror, variant.args[i], variant.context)
            if(error !== true) {
              errors = errors.concat(error);
              result = false;
              break;
            }
          }
          if(result) {
            overall = true;
          }
        }
        if (!overall) {
          let tmp = " returning "+want;
          if (want === undefined)
            tmp = "";
          let tmp2 = variants;
          if (typeof variants === "object")
            tmp2 = variants.map(function(variant) { return variant.args.join(",");}).join(" or ");
          errors.push(new ParseWarning("Wrong arguments to '"+feature.name+"'"+tmp+ "; Possible Arguments: "+tmp2, feature));
          return errors; //cascade up
        }
        return true;
      }
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
     _ id:Identifier _ '(' args:Arguments _ ')' { return new parsedFeature(id, args, "operation", location());} /
     _ id:Identifier _ { return new parsedFeature(id, null, "feature", location()); }

Arguments =
	a:(f:Level0 ',' { return f;})* f:Level0 { return a.concat([f]);}

Const "Constant"
  = Number / Bool

Identifier "Feature"
  = [a-z0-9_]i+ { return text(); }

Number
  ='-'?([0-9]+[.]?[0-9]*/[.][0-9]+)([eE][+-]?[0-9]+)? { return new parsedFeature(Number(text()), null, "number", location()); }
  
Bool
  = ('true'i/'false'i) { return new parsedFeature(text().toLowerCase() == "true", null, "boolean", location()); }

_ "whitespace"
  = [ \t\n\r]*
